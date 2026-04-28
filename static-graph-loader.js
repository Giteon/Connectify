/**
 * Static hosting: load bundled graph projects from graphs/<slug>/graph.json
 * with fallback to legacy graphs/<slug>/data.js (sets window.PROJECT).
 *
 * Used by editing-mode-new and view-mode-new before initApp runs.
 */
(function (global) {
  'use strict';

  function graphBasePath(slug) {
    return 'graphs/' + encodeURIComponent(slug) + '/';
  }

  /**
   * Fetch canonical project JSON. Sets window.PROJECT and resolves to it.
   * @param {string} slug
   * @param {string} [documentName] default graph.json
   */
  function loadBundledGraphJson(slug, documentName) {
    if (location.protocol === 'file:') {
      return Promise.reject(new Error('graph.json fetch blocked on file://'));
    }
    var file = documentName || 'graph.json';
    return fetch(graphBasePath(slug) + file, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('fetch failed: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var p = Object.assign({}, data);
        if (!p.slug) p.slug = slug;
        global.PROJECT = p;
        return p;
      });
  }

  function loadBundledGraphScript(slug) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = graphBasePath(slug) + 'data.js';
      s.onload = function () {
        if (global.PROJECT) resolve(global.PROJECT);
        else reject(new Error('data.js did not set PROJECT'));
      };
      s.onerror = function () { reject(new Error('failed to load data.js')); };
      document.head.appendChild(s);
    });
  }

  /**
   * Prefer graph.json; fall back to data.js for older deploys or local file quirks.
   */
  function bootstrapBundledProject(slug, documentName) {
    return loadBundledGraphJson(slug, documentName).catch(function () {
      return loadBundledGraphScript(slug);
    });
  }

  global.loadBundledGraphJson = loadBundledGraphJson;
  global.loadBundledGraphScript = loadBundledGraphScript;
  global.bootstrapBundledProject = bootstrapBundledProject;
})(window);
