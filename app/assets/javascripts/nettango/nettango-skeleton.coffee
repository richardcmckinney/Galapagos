import RactiveBlockForm from "./block-form.js"
import RactiveBuilder from "./builder.js"
import RactiveConfirmDialog from "./confirm-dialog.js"
import RactiveModelChooser from "./model-chooser.js"
import RactiveNetLogoModel from "./netlogo-model.js"
import RactiveOptionsForm from "./options-form.js"
import RactivePopupMenu from "./popup-menu.js"
import RactiveProjectChooser from "./project-chooser.js"

# (HTMLElement, Environment, Boolean, Boolean, (Boolean) => Unit) => Ractive
create = (element, playMode, runtimeMode, isDebugMode, setDebugMode) ->
  new Ractive({

    el: element,

    data: () -> {
      breeds:       []          # Array[String]
      canRedo:      false       # Boolean
      canUndo:      false       # Boolean
      isDebugMode:  isDebugMode # Boolean
      isSideBySide: false       # Boolean
      playMode:     playMode    # Boolean
      runtimeMode:  runtimeMode # String
    }

    observe: {

      'isDebugMode': () ->
        setDebugMode(@get('isDebugMode'))
        return

    }

    on: {

      'complete': (_) ->
        popupMenu = @findComponent('popupMenu')
        document.addEventListener('click', (event) ->
          if event?.button isnt 2
            popupMenu.unpop()
        )

        return

      '*.show-confirm-dialog': ({ event: { pageY } }, options) ->
        confirmDialog = @findComponent('confirmDialog')
        options.top   = options?.top ? Math.max(pageY - 100, 50)
        confirmDialog.show(options)
        return

      '*.show-project-chooser': ({ event: { pageY } }) ->
        projectChooser = @findComponent('projectChooser')
        projectChooser.show(Math.max(pageY - 100, 50))
        return

      '*.show-model-chooser': ({ event: { pageY } }) ->
        modelChooser = @findComponent('modelChooser')
        modelChooser.show(Math.max(pageY - 100, 50))
        return

      '*.show-block-edit-form': (_, target, spaceName, block, blockIndex, submitLabel, submitEvent, cancelLabel) ->
        blockForm = @findComponent('blockEditForm')
        blockForm.show(target, spaceName, block, blockIndex, submitLabel, submitEvent, cancelLabel)
        return

      '*.show-options-form': (_, target, options, clearAllTarget) ->
        optionsForm = @findComponent("optionsForm")
        optionsForm.show(target, options, clearAllTarget)
        return

      '*.show-popup-menu': (_, target, top, left, options) ->
        popupMenu = @findComponent('popupMenu')
        popupMenu.popup(target, top, left, options)
        return

    }

    components: {
      blockEditForm:  RactiveBlockForm
    , confirmDialog:  RactiveConfirmDialog
    , modelChooser:   RactiveModelChooser
    , netLogoModel:   RactiveNetLogoModel
    , optionsForm:    RactiveOptionsForm
    , popupMenu:      RactivePopupMenu
    , projectChooser: RactiveProjectChooser
    , tangoBuilder:   RactiveBuilder
    },

    template:
      """
      <div class="ntb-components{{# isSideBySide }} netlogo-display-horizontal{{/}}">
        <confirmDialog />
        {{# !playMode }}
        <modelChooser runtimeMode="{{runtimeMode}}" />
        <projectChooser />
        {{/}}
        <popupMenu />
        <blockEditForm blockStyles={{ blockStyles }} allTags={{ allTags }} />
        <optionsForm />
        <netLogoModel />
        <tangoBuilder
          playMode={{ playMode }}
          runtimeMode={{ runtimeMode }}
          canUndo={{ canUndo }}
          canRedo={{ canRedo }}
          breeds={{ breeds }}
          isDebugMode={{ isDebugMode }}
          isSideBySide={{ isSideBySide }}
          blockStyles={{ blockStyles }}
          allTags={{ allTags }}
        />
      </div>
      """

  })

NetTangoSkeleton = { create }

export default NetTangoSkeleton
