import TileEventType from 'ol/source/TileEventType'
import { expandUrl } from '../ol-ext'
import { fromOlEvent as obsFromOlEvent } from '../rx-ext'
import { and, isEmpty, isEqual, isString, negate, pick, replaceTokens } from '../utils'
import tileSource from './tile-source'

const isNotEmptyString = /*#__PURE__*/and(isString, negate(isEmpty))

export default {
  mixins: [
    tileSource,
  ],
  props: {
    // ol/source/UrlTile
    /**
     * @type {function|undefined}
     */
    tileLoadFunc: Function,
    /**
     * @deprecated Use `tileLoadFunc` instead.
     * @todo remove in v0.13.x
     */
    tileLoadFunction: Function,
    /**
     * @type {function|undefined}
     */
    tileUrlFunc: Function,
    /**
     * @type {string|undefined}
     */
    url: {
      type: String,
      validator: isNotEmptyString,
    },
    /**
     * @type {string[]|undefined}
     */
    urls: {
      type: Array,
      validator: value => value.every(isNotEmptyString),
    },
  },
  computed: {
    urlTokens () {
      return []
    },
    parsedUrl () {
      if (!this.url) return

      return replaceTokens(this.url, pick(this, this.urlTokens))
    },
    parsedUrls () {
      const urls = []

      if (this.url) {
        urls.push(this.url)
      }
      if (this.urls && this.urls.length > 0) {
        urls.push(...this.urls)
      }

      const tokens = pick(this, this.urlTokens)

      return urls.map(url => replaceTokens(url, tokens))
    },
    expandedUrls () {
      return this.parsedUrls.reduce((urls, url) => urls.concat(...expandUrl(url)), [])
    },
    resolvedTileUrlFunc () {
      return this.tileUrlFunc
    },
    resolvedTileLoadFunc () {
      return this.tileLoadFunc || this.tileLoadFunction
    },
  },
  watch: {
    async parsedUrl (value) {
      await this.onParsedUrlChanged(value)
    },
    async expandedUrls (value) {
      await this.onExpandedUrlsChanged(value)
    },
    async resolvedTileLoadFunc (value) {
      await this.onTileLoadFuncChanged(value)
    },
    async resolvedTileUrlFunc (value) {
      await this.onTileUrlFuncChanged(value)
    },
  },
  created () {
    if (process.env.NODE_ENV !== 'production') {
      if (this.tileLoadFunction) {
        this.$logger.warn("'tileLoadFunction' prop is deprecated. Use 'tileLoadFunc' prop instead.")
      }
    }
  },
  updated () {
    if (process.env.NODE_ENV !== 'production') {
      if (this.tileLoadFunction) {
        this.$logger.warn("'tileLoadFunction' prop is deprecated. Use 'tileLoadFunc' prop instead.")
      }
    }
  },
  methods: {
    /**
     * @returns {void}
     */
    subscribeAll () {
      this::tileSource.methods.subscribeAll()
      this::subscribeToSourceEvents()
    },
    .../*#__PURE__*/pick(tileSource.methods, [
      'beforeInit',
      'init',
      'deinit',
      'beforeMount',
      'mount',
      'unmount',
      'refresh',
      'scheduleRefresh',
      'remount',
      'scheduleRemount',
      'recreate',
      'scheduleRecreate',
      'getServices',
      'resolveSource',
      'resolveOlObject',
    ]),
    /**
     * @returns {Promise<module:ol/Tile.LoadFunction>}
     */
    async getTileLoadFunction () {
      return (await this.resolveSource()).getTileLoadFunction()
    },
    /**
     * @param {module:ol/Tile.LoadFunction} tileLoadFunction
     * @returns {Promise<void>}
     */
    async setTileLoadFunction (tileLoadFunction) {
      if (!tileLoadFunction) return
      if (tileLoadFunction === await this.getTileLoadFunction()) return

      (await this.resolveSource()).setTileLoadFunction(tileLoadFunction)
    },
    /**
     * @returns {Promise<module:ol/Tile.UrlFunction>}
     */
    async getTileUrlFunction () {
      return (await this.resolveSource()).getTileUrlFunction()
    },
    /**
     * @param {module:ol/Tile.UrlFunction} tileUrlFunction
     * @param {number} [tileKey]
     * @returns {Promise<void>}
     */
    async setTileUrlFunction (tileUrlFunction, tileKey) {
      if (!tileUrlFunction) return
      if (tileUrlFunction === await this.getTileUrlFunction()) return

      (await this.resolveSource()).setTileUrlFunction(tileUrlFunction, tileKey)
    },
    /**
     * @returns {Promise<string[]|undefined>}
     */
    async getUrls () {
      return (await this.resolveSource()).getUrls()
    },
    /**
     * @param {string[]} urls
     * @returns {Promise<void>}
     */
    async setUrls (urls) {
      if (isEqual(urls, await this.getUrls())) return

      (await this.resolveSource()).setUrls(urls)
    },
    /**
     * @param {string} url
     * @returns {Promise<void>}
     */
    async setUrl (url) {
      await this.setUrls(expandUrl(url))
    },
    async onParsedUrlChanged (url) {},
    async onExpandedUrlsChanged (urls) {},
    async onTileLoadFuncChanged (tileLoadFunc) {
      await this.setTileLoadFunction(tileLoadFunc)
    },
    async onTileUrlFuncChanged (tileUrlFunc) {
      await this.setTileUrlFunction(tileUrlFunc, this.rev)
    },
  },
}

async function subscribeToSourceEvents () {
  const events = obsFromOlEvent(this.$source, [
    TileEventType.TILELOADSTART,
    TileEventType.TILELOADEND,
    TileEventType.TILELOADERROR,
  ])
  this.subscribeTo(events, evt => this.$emit(evt.type, evt))
}
