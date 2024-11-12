const libs = {
  cron: require('/lib/cron'),
  task: require('/lib/xp/task')
}

exports.run = function () {
  libs.cron.schedule({
    name: 'sync-image-info',
    cron: '0 * * * *',
    callback: function () {
      const taskIsRunning = libs.task.isRunning(app.name + ':sync-image-info')

      if (!taskIsRunning) {
        libs.task.submitTask({
          descriptor: 'sync-image-info',
          config: {}
        })
      }
    },
    context: {
      user: {
        login: 'su',
        idProvider: 'system'
      },
      principals: ['role:system.admin'],
      repository: 'com.enonic.cms.default',
      branch: 'draft'
    }
  })
}
