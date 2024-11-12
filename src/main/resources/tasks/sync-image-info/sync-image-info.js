const libs = {
  content: require('/lib/xp/content'),
  context: require('/lib/xp/context'),
  iimage: require('/lib/modules/iimage'),
  objects: require('/lib/utils/objects'),
  repo: require('/lib/xp/repo'),
  task: require('/lib/xp/task'),
}

exports.run = function () {
  const validRepositories = getValidRepositories()

  validRepositories.forEach((repository) => {
    libs.context.run({
      user: { login: 'su', idProvider: 'system' },
      principals: ['role:system.admin'],
      repository: repository.id,
      branch: 'draft'
    }, () => {

      const imagesQuery = libs.content.query({
        query: 'x.io-99x-imageshop.iimage.document_id LIKE "*"',
        start: 0,
        count: -1
      })

      if (imagesQuery.total) {
        log.info(`${imagesQuery.total} results found for the ${repository.id} repository`)
        const firstImageId = imagesQuery.hits[0]._id
        const iimageAppConfig = libs.iimage.getSiteConfig(firstImageId)

        imagesQuery.hits.forEach(image => {
          libs.iimage.requestImageInfoAndModifyContent({ image, appConfig: iimageAppConfig })
        })
      } else {
        log.info(`No results found for the ${repository.id} repository`)
      }
    })
  })
}


/**
 * Gets the list of repositories that match with 'com.enonic.cms.' standard and return them
 * @returns {Array<{ id }>} array of repositories objects
 */
function getValidRepositories () {
  return libs.context.run({
    user: { login: 'su', idProvider: 'system' },
    principals: ['role:system.admin'],
    repository: 'com.enonic.cms.default',
    branch: 'master'
  }, () => {
    const repositories = libs.repo.list()
    const repositoriesArray = repositories && libs.objects.forceArray(repositories)
    let validRepositories = []

    if (repositories && repositories.length) {
      validRepositories = repositoriesArray.filter(repository => String(repository.id).match(/^\bcom.enonic.cms.\b.+/g)).map(repository => ({ id: repository.id }))
      // validRepositories = validRepositories.filter(repository => repository.id !== 'com.enonic.cms.default')
    }

    return validRepositories
  })
}