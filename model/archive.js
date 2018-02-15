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
    this.fetchedHistory = []
    this.progress = null

    // wire up events
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

  async setup () {
    this.info = await this.getInfo()
    this.emitChanged()
    console.log(this.info)
  }

  async fetchHistory() {
    if (this.__fetchingHistory) return
    this.__fetchingHistory = true
    this.fetchedHistory = await this.history()
    this.__fetchingHistory = false
    this.emitChanged()
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
    if (this.progress) this.progress.destroy()
    this.progress = null
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
}

function trimLeadingSlash (str) {
  return str.replace(/^(\/)*/, '')
}
