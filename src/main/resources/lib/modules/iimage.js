/// <reference path="./types.js" />

const libs = {
  content: require('/lib/xp/content'),
  context: require('/lib/xp/context'),
  schema: require('/lib/xp/schema'),
  node: require('/lib/xp/node'),
  io: require('/lib/xp/io'),
  i18n: require('/lib/xp/i18n'),
  objects: require('/lib/utils/objects'),
  httpClient: require('/lib/http-client'),
  XML: Java.type('org.json.XML')
}

module.exports = {
  getConnection,
  getImageShopURL,
  getInputsAllowedToUploadImage,
  getSite,
  getSitesWithIImageAppInstalled,
  getSiteConfig,
  requestImageInfoAndModifyContent,
  translate
}

let connection = null

function getSitesWithIImageAppInstalled() {
  const sites = libs.content.query({
    query: `data.siteConfig.applicationKey = '${app.name}'`,
    contentTypes: ['portal:site'],
    count: -1
  })

  return sites.hits
}

/**
 * Returns the site configuration for a given content ID
 * @param {String} contentId Enonic XP content ID
 * @returns {{ iimage_imported_resources_folder: String }}
 */
function getSiteConfig(contentId) {
  const siteConfig = libs.content.getSiteConfig({
    key: contentId,
    applicationKey: app.name
  })

  return siteConfig
}

function getSite (contentId) {
  const site = libs.content.getSite({
    key: contentId
  })

  return site
}

/**
 * Returns the inputs allowed to upload image
 * @param {String} contentId Enonic XP content ID
 * @returns {Array<{ name: String, label: String }>}
 */
function getInputsAllowedToUploadImage(contentId) {
  if (!contentId) return []

  const currentContent = libs.content.get({ key: contentId })
  const currentContentType = libs.content.getType(currentContent.type)
  
  const connection = getConnection()

  let partsWithImageSelector = []

  if (connection) {
    const n = connection.draft.get(contentId)
    const parts = n.components ? libs.objects.forceArray(n.components).filter(c => c.type === 'part') : []

    const processedParts = {}

    parts.forEach(p => {
      const descriptor = p.part.descriptor

      const part = libs.schema.getComponent({ key: descriptor, type: 'PART' })
      
      const form = explodeFieldSets(part.form)

      const filteredInputs = form.filter(item => item.formItemType === 'Input' && item.inputType === 'ImageSelector')
      
      if (processedParts[part.displayName]) processedParts[part.displayName]++
      else processedParts[part.displayName] = 1

      filteredInputs.forEach(item => {
        let label = `${item.label} (${part.displayName} PART)`

        if (processedParts[part.displayName] > 1) label += ` (${processedParts[part.displayName]})`

        partsWithImageSelector.push({
          name: item.name,
          label,
          path: p.path,
          type: 'PART'
        })
      })
    })
  }

  //Make fieldsets flat
  const form = explodeFieldSets(currentContentType.form)

  return form.filter(item => item.formItemType === 'Input' && item.inputType === 'ImageSelector').map(item => ({
    name: item.name,
    label: item.label,
    path: '',
    type: 'CONTENT-TYPE'
  })).concat(partsWithImageSelector)
}

/**
 * Returns the form object, with all fieldsets exploded
 * @param {Array<{any}>} form Enonic content type form
 * @returns {Array<{any}>}
 */
function explodeFieldSets(form){
  form = libs.objects.forceArray(form);
  let fieldSets = form.filter(item => item.formItemType === 'Layout')
  for (let fieldSet of fieldSets){
    form = form.concat(explodeFieldSets(fieldSet.items));
  }
  return form.filter(item => item.formItemType != 'Layout')
}

/**
 * @param {AppConfig} appConfig 
 * @returns 
 */
function getTemporaryToken (appConfig) {
  
  try {
    const temporaryTokenRequest = libs.httpClient.request({
      url: 'https://webservices.imageshop.no/V4.asmx/GetTemporaryToken',
      method: 'GET',
      queryParams: {
        privateKey: app.config.imageshopPrivateKey || appConfig.iimage_private_key,
        token: app.config.imageshopToken || appConfig.iimage_token
      }
    })

    const response = temporaryTokenRequest && libs.io.readText(temporaryTokenRequest.bodyStream) // <- XML string from the response
    if (response && libs.objects.trySafe(() => temporaryTokenRequest.status === 200)) {
      const parsedResponse = JSON.parse(libs.XML.toJSONObject(response))
      
      return {
        token: libs.objects.trySafe(() => parsedResponse.string.content)
      }
    }

  } catch (error) {
    log.error(`ImageShop Integration: Error while requesting a temporary token: ${error}`)
  }
}

/**
 * 
 * @param {AppConfig} appConfig 
 * @returns 
 */
function getImageShopURL (appConfig) {
  const temporaryToken = getTemporaryToken(appConfig)

  let imageshopsitepath = `${appConfig.iimage_host}?FORMAT=json&SETDOMAIN=false&SHOWSIZEDIALOGUE=true&SHOWCROPDIALOGUE=true&REMEMBERSEARCH=true`

    if (appConfig.iimage_interface_name) imageshopsitepath += `&IMAGESHOPINTERFACENAME=${encodeURI(appConfig.iimage_interface_name)}`
    if (appConfig.iimage_sizes) {
      const imageSizesJoined = libs.objects.forceArray(appConfig.iimage_sizes).join(':')
      imageshopsitepath += `&IMAGESHOPSIZES=${encodeURI(imageSizesJoined)}`
    }
    if (appConfig.iimage_document_prefix) imageshopsitepath += `&IMAGESHOPDOCUMENTPREFIX=${encodeURI(appConfig.iimage_document_prefix)}`
    if (temporaryToken.token) imageshopsitepath += `&IMAGESHOPTOKEN=${encodeURI(temporaryToken.token)}`

    return imageshopsitepath
}

/**
 * 
 * @param {Object} params 
 * @param {Object} params.image Enonic image content
 * @param {AppConfig} params.appConfig
 */
function requestImageInfoAndModifyContent (params) {
  try {
    if (!params.image || !params.appConfig) throw new Error('Missing params')

    const imageId = params.image._id
    
    log.info(JSON.stringify(`Processing item [${imageId}]`))
  
    const token = params.appConfig.iimage_token
    const language = params.appConfig.iimage_language
    const documentId = libs.objects.trySafe(() => params.image.x['io-99x-imageshop'].iimage.document_id)
    
    const response = libs.httpClient.request({
      url: 'https://api.imageshop.no/Document/GetDocumentById',
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache', token },
      params: {
        language,
        DocumentID: documentId,
        format: 'json'
      }
    })
  
    if (response.status !== 200) throw new Error(`Reponse status (${response.status}) for image info request different from 200`)

    const data = JSON.parse(response.body)

    getConnection()

    const draftContentVersion = connection.draft.getActiveVersion({ key: imageId })
    const masterContentVersion = connection.master.getActiveVersion({ key: imageId })

    const result = {}

    const modifiedContent = libs.content.modify({
      key: imageId,
      editor: function (c) {
        c.displayName = data.Name
        c.data.altText = data.AltText

        return c
      }
    })

    result.modified = !!modifiedContent

    if (!masterContentVersion) {
      log.info(`Image [${imageId}] not published because it's not published`)

      return result
    }

    if (draftContentVersion.versionId === masterContentVersion.versionId) {
      const expected = libs.content.publish({
        keys: [imageId],
        excludeChildrenIds: [imageId],
        includeDependencies: false,
        sourceBranch: 'draft',
        targetBranch: 'master'
      })

      result.published = !!expected.pushedContents.length

      return result
    }
    log.info(`Image [${imageId}] not published due to different versions in draft and master`)
  } catch (error) {
    log.error(`ImageShop: Error while requesting the image info: ${error}`)
  }
}

function translate (key, values = []) {
  return libs.i18n.localize({ key: key, locale: 'no', values })
}

/**
 * Gets the connection from the current context repository for draft and master branches. 
 * @returns {{ draft: Object, master: Object }}
 */
function getConnection () {
  const context = libs.context.get()

  if (connection) return connection

  connection = {
    draft: libs.node.connect({ repoId: context.repository, branch: 'draft' }),
    master: libs.node.connect({ repoId: context.repository, branch: 'master' })
  }

  return connection
}