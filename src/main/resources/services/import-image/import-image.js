/// <reference path="../../lib/modules/types.js" />

const libs = {
  content: require('/lib/xp/content'),
  common: require('/lib/xp/common'),
  httpClient: require('/lib/http-client'),
  iimage: require('/lib/modules/iimage'),
  objects: require('/lib/utils/objects'),
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
    const currentSiteLanguage = iimageAppConfig.iimage_language || libs.objects.trySafe(() => libs.iimage.getSite(params.contentId).language)
    const importedImageFolder = iimageAppConfig.iimage_imported_resources_folder ? libs.content.get({ key: iimageAppConfig.iimage_imported_resources_folder }) : null

    if (!importedImageFolder) {
      return {
        status: 400,
        body: {
          message: libs.iimage.translate('iimage.service.import-image.no_folder_found')
        },
        contentType: 'application/json'
      }
    }

    const response = libs.httpClient.request({
      url: imageData.image.file,
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    })

    if (response.status === 200) {
      const extractedImageInfo = extractImageInfo({ siteLanguage: currentSiteLanguage, imageData, appConfig: iimageAppConfig })

      let image = libs.content.createMedia({
        name: extractedImageInfo.sanitizedTitle,
        parentPath: importedImageFolder._path,
        mimeType: response.contentType,
        // focalX: libs.objects.trySafe(() => Math.abs(imageData.focalPoint.x * -4.3028846153846)),
        // focalY: libs.objects.trySafe(() => Math.abs(imageData.focalPoint.y)),
        data: response.bodyStream
      })

      if (image) {
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

        const currentContent = libs.content.get({ key: params.contentId })

        if (currentContent && propertyName && !propertyPath) {
          const updatedContent = libs.content.modify({
            key: params.contentId,
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

                  component.part.config[appName][partName][propertyName] = image._id

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
    return {
      body: {
        message: `Error: ${e}`
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