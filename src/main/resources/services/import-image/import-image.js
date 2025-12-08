/// <reference path="../../lib/modules/types.js" />

const libs = {
  content: require('/lib/xp/content'),
  context: require('/lib/xp/context'),
  common: require('/lib/xp/common'),
  httpClient: require('/lib/http-client'),
  iimage: require('/lib/modules/iimage'),
  objects: require('/lib/utils/objects'),
  imageConverter: require('/lib/utils/image-converter')
}

exports.post = function (request) {
  try {
    const params = request.params
    const data = JSON.parse(request.body)
    /** @type ImageInfo */
    const imageData = data.imageData || {}
    const propertyName = data.propertyName
    const propertyPath = data.propertyPath

    if (!params.contentId) {
      return {
        status: 400,
        body: {
          message: libs.iimage.translate('iimage.service.import-image.no_site_with_iimage_app_installed')
        },
        contentType: 'application/json'
      }
    }

    const iimageAppConfig = libs.iimage.getSiteConfig(params.contentId)
    const storeInRootSite = libs.objects.trySafe(() => iimageAppConfig.iimage_store_in_root_site === true || iimageAppConfig.iimage_store_in_root_site === 'true')
    
    // Determine which site to use (root or current)
    let targetSite = libs.iimage.getSite(params.contentId)
    let targetSiteConfig = iimageAppConfig
    let targetSiteLanguage = iimageAppConfig.iimage_language || libs.objects.trySafe(() => targetSite.language)
    let rootRepository = null
    
    if (storeInRootSite) {
      const rootSiteResult = libs.iimage.getRootSite(params.contentId)
      if (!rootSiteResult || !rootSiteResult.site || !rootSiteResult.repository) {
        return {
          status: 400,
          body: {
            message: libs.iimage.translate('iimage.service.import-image.root_site_not_found')
          },
          contentType: 'application/json'
        }
      }
      
      const rootSite = rootSiteResult.site
      rootRepository = rootSiteResult.repository
      
      // Get root site config
      targetSite = rootSite
      
      targetSiteConfig = libs.context.run({
        repository: rootRepository,
        branch: 'draft'
      }, () => {
        return libs.iimage.getSiteConfig(rootSite._id)
      })
      
      // If root site doesn't have app configured, we'll create a default folder
      targetSiteLanguage = targetSiteConfig ? (targetSiteConfig.iimage_language || libs.objects.trySafe(() => rootSite.language)) : libs.objects.trySafe(() => rootSite.language)
    }
    
    // Use token from target site config, or fall back to current site config if root site doesn't have app
    const token = targetSiteConfig ? targetSiteConfig.iimage_token : iimageAppConfig.iimage_token
    
    // Get imported image folder in the correct repository context
    let importedImageFolder
    if (storeInRootSite && rootRepository) {
      importedImageFolder = libs.context.run({
        repository: rootRepository,
        branch: 'draft'
      }, () => {
        // If folder is configured, use it
        if (targetSiteConfig && targetSiteConfig.iimage_imported_resources_folder) {
          const folder = libs.content.get({ key: targetSiteConfig.iimage_imported_resources_folder })
          if (folder) return folder
        }
        
        // Otherwise, create or get default folder
        const defaultFolderDisplayName = 'Imageshop Import'
        const defaultFolderName = libs.common.sanitize(defaultFolderDisplayName)
        // Use root site's path as parent (sites are typically at /content/<site-name>)
        const sitePath = targetSite._path || '/content'
        
        // Try to find existing folder first
        try {
          const folderQuery = libs.content.query({
            query: `_path = "${sitePath}/${defaultFolderName}" AND type = "base:folder"`,
            contentTypes: ['base:folder'],
            count: 1
          })
          
          if (folderQuery.hits && folderQuery.hits.length > 0) {
            return folderQuery.hits[0]
          }
        } catch (e) {
          // Query failed, will try to create folder
        }
        
        // Create default folder under the root site
        try {
          const newFolder = libs.content.create({
            name: defaultFolderName,
            parentPath: sitePath,
            displayName: defaultFolderDisplayName,
            contentType: 'base:folder',
            data: {}
          })
          log.info(`Created default images folder at ${newFolder._path} in root site`)
          return newFolder
        } catch (createError) {
          log.error(`Failed to create default images folder in root site at ${sitePath}: ${createError}`)
          return null
        }
      })
    } else {
      importedImageFolder = targetSiteConfig && targetSiteConfig.iimage_imported_resources_folder ? libs.content.get({ key: targetSiteConfig.iimage_imported_resources_folder }) : null
    }

    if (!importedImageFolder) {
      return {
        status: 400,
        body: {
          message: libs.iimage.translate('iimage.service.import-image.no_folder_found')
        },
        contentType: 'application/json'
      }
    }

    let downloadImageURL = imageData.image.file

    const fullSizeImageRequest = libs.httpClient.request({
      url: `https://api.imageshop.no/Download`,
      method: 'POST',
      headers: { 'Cache-Control': 'no-cache', token },
      body: JSON.stringify({
        DocumentId: imageData.documentId,
        Quality: 'FullSize'
      })
    })

    if (fullSizeImageRequest.status === 200) {
      const fullSizeImageResponseBody = JSON.parse(fullSizeImageRequest.body)
      downloadImageURL = fullSizeImageResponseBody.Url
    }

    const response = libs.httpClient.request({
      url: downloadImageURL,
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    })

    if (response.status === 200) {
      const extractedImageInfo = extractImageInfo({ siteLanguage: targetSiteLanguage, imageData, appConfig: targetSiteConfig })

      // Check if WebP conversion is enabled and download full size is NOT checked
      const downloadFullSize = libs.objects.trySafe(() => targetSiteConfig.iimage_download_full_size)
      
      let imageStream = response.bodyStream
      let mimeType = response.contentType
      let imageName = extractedImageInfo.sanitizedTitle

      // Convert to WebP if enabled and download full size is NOT checked
      if (downloadFullSize) {
        try {
          imageStream = libs.imageConverter.convertToWebP({
            imageStream: response.bodyStream,
            quality: 85
          })
          mimeType = 'image/webp'
          // Update file extension to .webp
          imageName = imageName.replace(/\.(png|jpg|jpeg)$/i, '.webp')
          if (!/\.webp$/i.test(imageName)) {
            imageName += '.webp'
          }
        } catch (conversionError) {
          log.error(`Failed to convert image to WebP, using original format: ${conversionError}`)
          // Continue with original format if conversion fails
        }
      }

      // Create image in the appropriate repository context
      let image
      if (storeInRootSite && rootRepository) {
        // Switch to root site's repository to create the image
        image = libs.context.run({
          repository: rootRepository,
          branch: 'draft'
        }, () => {
          return libs.content.createMedia({
            name: imageName,
            parentPath: importedImageFolder._path,
            mimeType: mimeType,
            // focalX: libs.objects.trySafe(() => Math.abs(imageData.focalPoint.x * -4.3028846153846)),
            // focalY: libs.objects.trySafe(() => Math.abs(imageData.focalPoint.y)),
            data: imageStream
          })
        })
      } else {
        // Use current repository context
        image = libs.content.createMedia({
          name: imageName,
          parentPath: importedImageFolder._path,
          mimeType: mimeType,
          // focalX: libs.objects.trySafe(() => Math.abs(imageData.focalPoint.x * -4.3028846153846)),
          // focalY: libs.objects.trySafe(() => Math.abs(imageData.focalPoint.y)),
          data: imageStream
        })
      }

      if (image) {
        // Modify image in the appropriate repository context
        if (storeInRootSite && rootRepository) {
          image = libs.context.run({
            repository: rootRepository,
            branch: 'draft'
          }, () => {
            return libs.content.modify({
              key: image._id,
              editor: function (c) {
                c.displayName = extractedImageInfo.title
                c.data.altText = extractedImageInfo.altText
                c.data.caption = extractedImageInfo.caption

                c.x['io-99x-imageshop'] = {
                  iimage: {
                    callback_url: imageData.image.file,
                    document_id: imageData.documentId
                  }
                }
                return c
              }
            })
          })
        } else {
          image = libs.content.modify({
            key: image._id,
            editor: function (c) {
              c.displayName = extractedImageInfo.title
              c.data.altText = extractedImageInfo.altText
              c.data.caption = extractedImageInfo.caption

              c.x['io-99x-imageshop'] = {
                iimage: {
                  callback_url: imageData.image.file,
                  document_id: imageData.documentId
                }
              }
              return c
            }
          })
        }

        const currentContent = libs.content.get({ key: params.contentId })

        if (currentContent && propertyName && !propertyPath) {
          const updatedContent = libs.content.modify({
            key: params.contentId,
            requireValid: false,
            editor: function (c) {
              c.data[propertyName] = image._id

              return c
            }
          })

          image.wasContentUpdated = !!updatedContent
        }

        if (currentContent && propertyName && propertyPath) {
          const connection = libs.iimage.getConnection()

          if (connection) {
            connection.draft.modify({
              key: params.contentId,
              editor: function (n) {
                n.components = n.components.map(component => {
                  if (component.type !== 'part' || component.path !== propertyPath) return component

                  const descriptor = String(component.part.descriptor).split(':')
                  const appName = descriptor[0].replace(/\./g, "-");
                  const partName = descriptor[1]

                  if (!component.part.config) {
                    component.part.config = {}
                    component.part.config[appName] = {}
                    component.part.config[appName][partName] = {
                      [propertyName]: image._id
                    }
                  } else {
                    component.part.config[appName][partName][propertyName] = image._id
                  }

                  return component
                })

                return n
              }
            })
          }
        }

        image.editURL = generateEditURL({ request, imageId: image._id })
      }

      return {
        body: {
          status: 201,
          message: libs.iimage.translate('iimage.service.import-image.image_imported_successfully'),
          image
        },
        contentType: 'application/json'
      }
    }

    return {
      body: {
        message: libs.iimage.translate('iimage.service.import-image.image_import_failed')
      },
      contentType: 'application/json'
    }

  } catch (e) {
    log.info(`Error while importing image: ${e}`)
    return {
      body: {
        message: libs.iimage.translate('iimage.service.import-image.image_import_failed')
      },
      contentType: 'application/json'
    }
  }
}

function generateEditURL(params) {
  const hostURL = params.request.headers.Referer

  if (hostURL.indexOf('/edit') !== -1) {
    return String(hostURL).split('/').slice(0, -1).join('/') + `/${params.imageId}`
  }
  
  const repositoryId = params.request.repositoryId
  const siteName = String(repositoryId).split('.').slice(-1)
  return `${hostURL}/${siteName}/edit/${params.imageId}`
}

/**
 * Extracts title, alternative text and caption from the image data object
 * @param {Object} params
 * @param {String} params.siteLanguage
 * @param {ImageInfo} params.imageData
 * @param {AppConfig} params.appConfig
 */
function extractImageInfo (params) {
  const appConfig = params.appConfig
  const siteLanguage = params.siteLanguage
  const imageDataText = params.imageData.text
  const fallbackTitle = libs.objects.trySafe(() => params.imageData.image.file.split('/').pop())

  /** @type LocalizedText */
  const localizedData = libs.objects.trySafe(() => imageDataText[siteLanguage] || imageDataText.en)

  const altTextLabel = libs.objects.trySafe(() => String(appConfig.iimage_language_alt_label || 'alt tekst').toLowerCase().trim())
  const captionLabel = libs.objects.trySafe(() => String(appConfig.iimage_language_caption || 'bildetekst').toLowerCase().trim())

  return {
    title: localizedData.title || fallbackTitle,
    sanitizedTitle: libs.common.sanitize(localizedData.title || fallbackTitle),
    altText: libs.objects.trySafe(() => localizedData.documentinfo.filter(document => String(document.Name).toLowerCase().trim() === altTextLabel)[0].Value),
    caption: libs.objects.trySafe(() => localizedData.documentinfo.filter(document => String(document.Name).toLowerCase().trim() === captionLabel)[0].Value)
  }
}