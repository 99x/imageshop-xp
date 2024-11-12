
const libs = {
  content: require('/lib/xp/content'),
  common: require('/lib/xp/common'),
  httpClient: require('/lib/http-client'),
  iimage: require('/lib/modules/iimage'),
  objects: require('/lib/utils/objects'),
}

exports.get = function (request) {
  try {
    const params = request.params

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
    const token = iimageAppConfig.iimage_token

    if (!token) {
      return {
        status: 400,
        body: {
          message: 'No token defined on your site config settings.'
        },
        contentType: 'application/json'
      }
    }

    const imageContent = libs.content.get({ key: params.contentId })
    const documentId = libs.objects.trySafe(() => imageContent.x['io-99x-imageshop'].iimage.document_id)

    if (!documentId) {
      return {
        status: 400,
        body: {
          message: "The selected content doesn't have a proper document id"
        },
        contentType: 'application/json'
      }
    }

    const response = libs.iimage.requestImageInfoAndModifyContent({ image: imageContent, appConfig: iimageAppConfig })
    
    return {
      status: 200,
      body: response,
      contentType: 'application/json'
    }
  } catch (error) {
    log.info(error)
    return {
      status: 500,
      body: {
        message: 'Internal Server Error'
      },
      contentType: 'application/json'
    }
  }
}