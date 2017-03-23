const {throttle} = require('../functions')
const EventTarget = require('./event-target')
const ProgressMonitor = require('./progress-monitor')

// constants
// =

// how much time to wait between throttle emits
const EMIT_CHANGED_WAIT = 30

// exported api
// =

module.exports = class LibraryDatArchive extends DatArchive {
  constructor (url) {
    super(url)

    // declare attributes
    this.info = null
    this.path = '/'
    this.files = {}
    this.history = []
    this.progress = null

    // wire up events
    this.fileActivity = this.createFileActivityStream()
    this.fileActivity.addEventListener('changed', this.onFileChanged.bind(this))
    this.fileActivity.addEventListener('invalidated', this.onFileInvalidated.bind(this))
    beaker.archives.addEventListener('updated', (this.onLibraryUpdated = e => {
      if (e.details.url === this.url) {
        this.getInfo().then(info => {
          this.info = info
          this.emitChanged()
        })
      }
    }))

    // create a throttled 'change' emiter
    this.emitChanged = throttle(() => this.dispatchEvent({type: 'changed'}), EMIT_CHANGED_WAIT)
  }

  setup (path) {
    return Promise.all([
      this.getInfo().then(info => {
        this.info = info
        this.emitChanged()
        console.log(this.info)
      }),
      this.setPath(path)
    ])
  }

  setPath(path) {
    if (!path) return
    this.path = path || '/'
    return this.listFiles(this.path, {downloadedBlocks: true}).then(files => {
      this.files = files
      console.log(this.path, this.files)
      this.emitChanged()
    })
  }

  fetchHistory() {
    if (this.__fetchingHistory) return
    this.__fetchingHistory = true

    return this.listHistory().then(history => {
      this.history = history
      this.emitChanged()
    })
  }

  startMonitoringDownloadProgress() {
    if (this.progress) return Promise.resolve()
    this.progress = new ProgressMonitor(this)
    return this.progress.setup()
  }

  destroy () {
    // unwire events
    this.listeners = {}
    beaker.archives.removeEventListener('updated', this.onLibraryUpdated)
    this.fileActivity.close()
    this.fileActivity = null
  }

  // getters
  //

  get key () {
    return this.url.slice('dat://'.length)
  }

  get niceName () {
    return this.info.title || 'Untitled'
  }

  get isSaved () {
    return this.info.userSettings.isSaved
  }

  get forkOf () {
    return this.info.forkOf && this.info.forkOf[0]
  }

  // utilities
  // =

  toggleSaved() {
    if (this.isSaved) {
      beaker.archives.remove(this.url).then(() => {
        this.info.userSettings.isSaved = false
        this.emitChanged()
      })
    } else {
      beaker.archives.add(this.url).then(() => {
        this.info.userSettings.isSaved = true
        this.emitChanged()
      })
    }
  }

  // event handlers
  // =

  onFileChanged(e) {
    this.setPath(this.path) // refetch files
    this.emitChanged()
  }

  onFileInvalidated(e) {
    this.setPath(this.path) // refetch files
    this.emitChanged()
  }
}

function trimLeadingSlash (str) {
  return str.replace(/^(\/)*/, '')
}
