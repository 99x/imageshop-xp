const libs = {
  context: require('/lib/xp/context'),
  syncImageInfoJob: require('/lib/jobs/sync-image-info.js')
}

libs.context.run({
  user: {
    login: 'su',
    idProvider: 'system'
  },
  principals: ['role:system.admin']
}, () => {
  libs.syncImageInfoJob.run()
})
