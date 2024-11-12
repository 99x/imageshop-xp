const libs = {
  task: require('/lib/xp/task'),
}

module.exports = {
  get: handleGet,
  post: handleGet
}

function handleGet (req) {
  if (req.webSocket) {
    return {
      webSocket: {
        data: {},
        subProtocols: ['text']
      }
    }
  }
  const taskIsRunning = libs.task.isRunning(app.name + ':sync-image-info')

  if (!taskIsRunning) {
    libs.task.submitTask({
      descriptor: 'sync-image-info',
      config: {}
    })
  }

  return {
    contentType: 'application/json',
    body: {
      taskIsRunning: taskIsRunning,
      status: libs.task.list({ name: app.name + ':sync-image-info' })
    }
  }
}