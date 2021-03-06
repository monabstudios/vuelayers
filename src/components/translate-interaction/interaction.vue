<script>
  import debounce from 'debounce-promise'
  import { Collection } from 'ol'
  import { Translate as TranslateInteraction } from 'ol/interaction'
  import { Vector as VectorSource } from 'ol/source'
  import VectorEventType from 'ol/source/VectorEventType'
  import { merge as mergeObs } from 'rxjs'
  import { map as mapObs } from 'rxjs/operators'
  import { FRAME_TIME, interaction } from '../../mixins'
  import { getLayerId } from '../../ol-ext'
  import { fromOlEvent as obsFromOlEvent } from '../../rx-ext'
  import { assert, instanceOf, isFunction, isString, map, makeWatchers, isEqual } from '../../utils'

  export default {
    name: 'VlInteractionTranslate',
    mixins: [
      interaction,
    ],
    stubVNode: {
      empty: false,
      attrs () {
        return {
          id: this.vmId,
          class: this.vmClass,
        }
      },
    },
    props: {
      source: {
        type: String,
        required: true,
      },
      layers: [String, Array],
      filter: Function,
      hitTolerance: {
        type: Number,
        default: 0,
      },
    },
    computed: {
      resolvedFilter () {
        if (isFunction(this.filter)) return this.filter

        let layers = this.layers
        if (!layers) return
        if (isString(layers)) layers = [layers]
        return (feature, layer) => layers.includes(getLayerId(layer))
      },
      currentHitTolerance () {
        if (this.rev && this.$interaction) {
          return this.getHitToleranceInternal()
        }

        return this.hitTolerance
      },
    },
    watch: {
      async hitTolerance (value) {
        await this.setHitTolerance(value)
      },
      currentHitTolerance: /*#__PURE__*/debounce(function (value) {
        if (value === this.hitTolerance) return

        this.$emit('update:hitTolerance', value)
      }, FRAME_TIME),
      .../*#__PURE__*/makeWatchers([
        'source',
        'resolvedFilter',
      ], prop => async function (val, prev) {
        if (isEqual(val, prev)) return

        if (process.env.VUELAYERS_DEBUG) {
          this.$logger.log(`${prop} changed, scheduling recreate...`)
        }

        await this.scheduleRecreate()
      }),
    },
    methods: {
      /**
       * @return {Promise<Modify>}
       * @protected
       */
      async createInteraction () {
        const source = this._source = await this.getInstance(this.source)
        assert(!!source, `Source "${this.source}" not found in identity map.`)

        let features
        if (source instanceof VectorSource) {
          features = source.getFeaturesCollection()
          if (!features) {
            features = new Collection(source.getFeatures())
            this.subscribeTo(
              obsFromOlEvent(source, VectorEventType.ADDFEATURE),
              ({ feature }) => feature && features.push(feature),
            )
            this.subscribeTo(
              obsFromOlEvent(source, VectorEventType.REMOVEFEATURE),
              ({ feature }) => feature && features.remove(feature),
            )
          }
          instanceOf(features, Collection, `Source "${this.source}" doesn't provide features collection.`)
        } else {
          if (isFunction(source.getFeaturesCollection)) {
            features = source.getFeaturesCollection()
          } else if (isFunction(source.getFeatures)) {
            features = source.getFeatures()
          }
          instanceOf(features, Collection, `Source "${this.source}" doesn't provide features collection.`)
        }

        return new TranslateInteraction({
          features,
          filter: this.resolvedFilter,
          hitTolerance: this.hitTolerance,
        })
      },
      /**
       * @return {void}
       * @protected
       */
      subscribeAll () {
        this::interaction.methods.subscribeAll()
        this::subscribeToInteractionChanges()
      },
      async getHitTolerance () {
        await this.resolveInteraction()

        return this.getHitToleranceInternal()
      },
      getHitToleranceInternal () {
        return this.$interaction.getHitTolerance()
      },
      async setHitTolerance (tolerance) {
        (await this.resolveInteraction()).setHitTolerance(tolerance)
      },
    },
  }

  /**
   * @private
   */
  function subscribeToInteractionChanges () {
    const vm = this
    const start = obsFromOlEvent(this.$interaction, 'translatestart')
    const end = obsFromOlEvent(this.$interaction, 'translateend')
    const progress = obsFromOlEvent(this.$interaction, 'translating')
    const events = mergeObs(start, end, progress).pipe(
      mapObs(({ type, features, coordinate, startCoordinate }) => ({
        type,
        features: features instanceof Collection ? features.getArray() : features,
        coordinate: vm.pointToDataProj(coordinate),
        startCoordinate: vm.pointToDataProj(startCoordinate),
        get json () {
          if (!this._json) {
            this._json = map(this.features, feature => vm.writeFeatureInDataProj(feature))
          }
          return this._json
        },
      })),
    )
    this.subscribeTo(events, evt => {
      this.$emit(evt.type, evt)
    })
  }
</script>
