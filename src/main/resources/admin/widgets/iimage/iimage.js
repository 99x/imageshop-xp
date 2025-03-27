const libs = {
  thymeleaf: require('/lib/thymeleaf'),
  portal: require('/lib/xp/portal'),
  content: require('/lib/xp/content'),
  iimage: require('/lib/modules/iimage'),
  objects: require('/lib/utils/objects')
}

exports.get = function (req) {
  const contentId = req.params.contentId
  const sitesWithIImageAppInstalled = libs.iimage.getSitesWithIImageAppInstalled()

  if (!contentId) {
    return {
      contentType: 'text/html',
      body: `<widget class="error">${libs.iimage.translate('iimage.widget.context_panel.fragments.no_content_selected')}</widget>`
    }
  }

  if (!sitesWithIImageAppInstalled.length) {
    return {
      contentType: 'text/html',
      body: `<widget class="error">${libs.iimage.translate('iimage.widget.context_panel.fragments.app_not_installed')}</widget>`
    }
  }

  if (sitesWithIImageAppInstalled.length > 1) {
    return {
      contentType: 'text/html',
      body: `<widget class="error">${libs.iimage.translate('iimage.widget.context_panel.fragments.app_installed_in_multiples_sites')}</widget>`
    }
  }

  const content = libs.content.get({ key: req.params.contentId })

  const iimageAppConfig = libs.iimage.getSiteConfig(contentId || sitesWithIImageAppInstalled[0]._id)

  if (!iimageAppConfig) {
    return {
      contentType: 'text/html',
      body: `<widget class="error">${libs.iimage.translate('iimage.widget.context_panel.fragments.app_not_installed_in_site_fetched')}</widget>`
    }
  }

  if (['iimage_host'].some(key => Object.keys(iimageAppConfig).indexOf(key) === -1)) {
    return {
      contentType: 'text/html',
      body: `<widget class="error">${libs.iimage.translate('iimage.widget.context_panel.fragments.app_misconfigured')}</widget>`
    }
  }

  const strings = {
    generalError: libs.iimage.translate('iimage.fragments.general_error'),
    editImage: libs.iimage.translate('iimage.fragments.edit_image'),
    openImageShop: libs.iimage.translate('iimage.fragments.open_image_shop'),
    importingImage: libs.iimage.translate('iimage.fragments.importing_image'),
    syncInfo: libs.iimage.translate('iimage.fragments.sync_image_info')
  }

  const showSyncButton = content && content.type === 'media:image' && !!libs.objects.trySafe(() => content.x['io-99x-imageshop'].iimage.document_id)

  const model = {
    importImageServiceUrl: libs.portal.serviceUrl({
      service: 'import-image',
      type: 'absolute',
      params: {
        contentId: contentId || sitesWithIImageAppInstalled[0]._id
      }
    }),
    syncImageInfoServiceUrl: showSyncButton ? libs.portal.serviceUrl({
      service: 'sync-image-info',
      type: 'absolute',
      params: {
        contentId
      }
    }) : undefined,
    imageShopURL: libs.iimage.getImageShopURL(iimageAppConfig),
    strings,
    stringsJson: JSON.stringify(strings),
    inputsAllowedToUploadImage: libs.iimage.getInputsAllowedToUploadImage(contentId),
    showSyncButton
  }

  return {
    body: libs.thymeleaf.render(resolve('iimage.html'), model),
    contentType: 'text/html'
  }
}
