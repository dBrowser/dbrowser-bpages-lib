const emitStream = require('emit-stream')
const EventEmitter = require('events')
const { writeToClipboard } = require('../events')

// globals
// =

// emit-stream for download events, only one per document is needed
var dlEvents

// exported api
// =

module.exports = class DownloadsList extends EventEmitter {
  constructor () {
    super()

    // declare attributes
    this.downloads = []

    // bind the event handlers
    this.onNewDownload = e => this._onNewDownload(e)
    this.onUpdateDownload = e => this._onUpdateDownload(e)

    // wire up events
    if (!dlEvents) {
      dlEvents = dbrowserx.downloads.createEventsStream()
    }
    dlEvents.addEventListener('new-download', this.onNewDownload)
    dlEvents.addEventListener('updated', this.onUpdateDownload)
    dlEvents.addEventListener('done', this.onUpdateDownload)
  }

  setup () {
    // fetch downloads
    return dbrowserx.downloads.getDownloads().then(downloads => {
      this.downloads = downloads
    })
  }

  destroy () {
    // unwire events
    this.removeAllListeners()
    dlEvents.removeEventListener('new-download', this.onNewDownload)
    dlEvents.removeEventListener('updated', this.onUpdateDownload)
    dlEvents.removeEventListener('done', this.onUpdateDownload)
  }

  // actions
  // =

  pauseDownload (download) {
    dbrowserx.downloads.pause(download.id)
  }

  resumeDownload (download) {
    dbrowserx.downloads.resume(download.id)
  }

  cancelDownload (download) {
    dbrowserx.downloads.cancel(download.id)
  }

  copyDownloadLink (download) {
    writeToClipboard(download.url)
  }

  showDownload (download) {
    dbrowserx.downloads.showInFolder(download.id)
      .catch(err => {
        download.fileNotFound = true
        this.emit('changed')
      })
  }

  openDownload (download) {
    dbrowserx.downloads.open(download.id)
      .catch(err => {
        download.fileNotFound = true
        this.emit('changed')
      })
  }

  removeDownload (download) {
    dbrowserx.downloads.remove(download.id)
    this.downloads.splice(this.downloads.indexOf(download), 1)
    this.emit('changed')
  }

  // event handlers
  // =

  _onNewDownload () {
    // do a little animation
    // TODO
  }

  _onUpdateDownload (download) {
    // patch data each time we get an update
    var target = this.downloads.find(d => d.id === download.id)
    if (target) {
      // patch item
      for (var k in download)
        target[k] = download[k]
    } else {
      this.downloads.push(download)
    }
    this.emit('changed')
  }
}
