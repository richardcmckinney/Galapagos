import { listenerEvents } from "/listener-events.js"
import { createDebugListener } from "/debug-listener.js"
import { createIframeRelayListener } from "/iframe-relay-listener.js"
import { createQueryHandler } from "/iframe-query-handler.js"

import "/codemirror-mode.js"
import AlertDisplay from "/alert-display.js"
import newModel from "/new-model.js"
import Tortoise from "/beak/tortoise.js"

var loadingOverlay  = document.getElementById("loading-overlay")
var activeContainer = loadingOverlay
var modelContainer  = document.querySelector("#netlogo-model-container")
var nlogoScript     = document.querySelector("#nlogo-code")
const params        = new URLSearchParams(window.location.search)

const paramKeys     = Array.from(params.keys())
if (paramKeys.length === 1) {
  const maybeUrl = paramKeys[0]
  if (maybeUrl.startsWith("http") && params.get(maybeUrl) === '') {
    params.delete(maybeUrl)
    params.set('url', maybeUrl)
    window.location.search = params.toString()
  }
}

var pageTitle       = function(modelTitle) {
  if (modelTitle != null && modelTitle != "") {
    return "NetLogo Web: " + modelTitle
  } else {
    return "NetLogo Web"
  }
}

globalThis.session = null
var speed          = 0.0
var isVertical     = true

var openSession = function(s) {
  globalThis.session = s
  globalThis.session.widgetController.ractive.set('speed', speed)
  globalThis.session.widgetController.ractive.set('isVertical', isVertical)
  document.title = pageTitle(globalThis.session.modelTitle())
  activeContainer = modelContainer
  globalThis.session.startLoop()
  alerter.setWidgetController(globalThis.session.widgetController)
}

const isStandaloneHTML = (nlogoScript.textContent.length > 0)
const isInFrame        = parent !== window
const alerter          = new AlertDisplay(document.getElementById('alert-container'), isStandaloneHTML)
const alertDialog      = document.getElementById('alert-dialog')

function handleCompileResult(result) {
  if (result.type === 'success') {
    openSession(result.session)
  } else {
    if (result.source === 'compile-recoverable') {
      openSession(result.session)
    } else {
      activeContainer = alertDialog
      loadingOverlay.style.display = "none"
    }
    notifyListeners('compiler-error', result.source, result.errors)
  }
}

const listeners = [alerter]

if (params.has('debugEvents')) {
  const debugListener = createDebugListener(listenerEvents)
  listeners.push(debugListener)
}
if (isInFrame && params.has('relayIframeEvents')) {
  const relayListener = createIframeRelayListener(listenerEvents, params.get('relayIframeEvents'))
  listeners.push(relayListener)
}

function notifyListeners(event, ...args) {
  listeners.forEach( (listener) => {
    if (listener[event] !== undefined) {
      listener[event](...args)
    }
  })
}

if (isInFrame) {
  createQueryHandler()
}

var loadModel = function(nlogo, path) {
  alerter.hide()
  if (globalThis.session) {
    globalThis.session.teardown()
  }
  activeContainer = loadingOverlay
  Tortoise.fromNlogo(nlogo, modelContainer, path, handleCompileResult, [], listeners)
}

const parseFloatOrElse = function(str, def) {
  const f = Number.parseFloat(str)
  return (f !== NaN ? f : def)
}

const clamp = function(min, max, val) {
  return Math.max(min, Math.min(max, val))
}

const readSpeed = function(params) {
  return params.has('speed') ? clamp(-1, 1, parseFloatOrElse(params.get('speed'), 0.0)) : 0.0
}

const redirectOnProtocolMismatch = function(url) {
  const uri = new URL(url)
  if ("https:" === uri.protocol || "http:" === window.location.protocol) {
    // we only care if the model is HTTP and the page is HTTPS. -Jeremy B May 2021
    return true
  }

  const loc         = window.location
  const isSameHost  = uri.hostname === loc.hostname
  const isCCL       = uri.hostname === "ccl.northwestern.edu"
  const port        = isSameHost && window.debugMode ? "9443" : "443"
  const newModelUrl = `https://${uri.hostname}:${port}${uri.pathname}`

  // if we're in an iframe we can't even reliably make a link to use
  // so just alert the user.
  if (!isSameHost && !isCCL && isInFrame) {
    alerter.reportProtocolError(uri, newModelUrl)
    activeContainer = alertDialog
    loadingOverlay.style.display = "none"
    return false
  }

  var newSearch = ""
  if (params.has("url")) {
    params.set("url", newModelUrl)
    newSearch = params.toString()
  } else {
    newSearch = newModelUrl
  }

  const newHref = `https://${loc.host}${loc.pathname}?${newSearch}`

  // if we're not on the same host the link might work, but let
  // the user know and let them click it.
  if (!isSameHost && !isCCL) {
    alerter.reportProtocolError(uri, newModelUrl, newHref)
    activeContainer = alertDialog
    loadingOverlay.style.display = "none"
    return false
  }

  window.location.href = newHref
  return false
}

speed        = readSpeed(params)
isVertical   = !(params.has('tabs') && params.get('tabs') === 'right')

if (nlogoScript.textContent.length > 0) {
  const nlogo  = nlogoScript.textContent
  const path   = nlogoScript.dataset.filename
  notifyListeners('model-load', 'script-element')
  Tortoise.fromNlogo(nlogo, modelContainer, path, handleCompileResult, [], listeners)

} else if (params.has('url')) {
  const url       = params.get('url')
  const modelName = params.has('name') ? decodeURI(params.get('name')) : undefined

  if (redirectOnProtocolMismatch(url)) {
    notifyListeners('model-load', 'url', url)
    Tortoise.fromURL(url, modelName, modelContainer, handleCompileResult, [], listeners)
  }

} else {
  notifyListeners('model-load', 'new-model')
  loadModel(newModel, "NewModel")
}

window.addEventListener("message", function (e) {
  switch (e.data.type) {
    case "nlw-load-model": {
      notifyListeners('model-load', 'file', e.data.path)
      loadModel(e.data.nlogo, e.data.path)
      break
    }
    case "nlw-open-new": {
      notifyListeners('model-load', 'new-model')
      loadModel(newModel, "NewModel")
      break
    }
    case "nlw-update-model-state": {
      globalThis.session.widgetController.setCode(e.data.codeTabContents);
      break
    }
    case "run-baby-behaviorspace": {
      var reaction =
        function(results) {
          e.source.postMessage({ type: "baby-behaviorspace-results", id: e.data.id, data: results }, "*")
        }
        globalThis.session.asyncRunBabyBehaviorSpace(e.data.config, reaction)
      break
    }
    case "nlw-export-model": {
      var model = session.getNlogo()
      e.source.postMessage({ type: "nlw-export-model-results", id: e.data.id, export: model }, "*")
      break
    }
  }
})

if (isInFrame) {
  var width = "", height = ""
  window.setInterval(function() {
    if (activeContainer.offsetWidth  !== width ||
        activeContainer.offsetHeight !== height ||
        (globalThis.session !== null && document.title != pageTitle(globalThis.session.modelTitle()))) {
      if (globalThis.session !== null) {
        document.title = pageTitle(globalThis.session.modelTitle())
      }
      width = activeContainer.offsetWidth
      height = activeContainer.offsetHeight
      parent.postMessage({
        width:  activeContainer.offsetWidth,
        height: activeContainer.offsetHeight,
        title:  document.title,
        type:   "nlw-resize"
      }, "*")
    }
  }, 200)
}
