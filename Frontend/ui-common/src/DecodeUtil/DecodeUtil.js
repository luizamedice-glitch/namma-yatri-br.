const JBridge = window.JBridge;

let fibers = [];
const nativePackageName = JSON.parse(JBridge.getDeviceInfo()).package_name;
const isDebug = nativePackageName.includes(".debug") || nativePackageName.includes(".staging");
const isBrDevelopment = window.__OS === "ANDROID" && window.__YATRI_BR_DEVELOPMENT__ === true && nativePackageName.endsWith(".debug");
let brConfigurationNoticeShown = false;
export const getFromWindow = function (key,nothing,just) {
  if (typeof window[key] !== "undefined") {
    return just(window[key]);
  } else {
    return nothing;
  }
}

export const getFromWindowString = getFromWindow;

export const getAnyFromWindow = getFromWindow;

export const removeFromWindow = function (key) {
  delete window[key];
}

export const setInWindow = function (key,value) {
  window[key] = value;
  return value;
}

export const setAnyInWindow = setInWindow;

// JSON UTILS
export function parseJSON(param) {
  try {
    return JSON.parse(param);
  } catch (e) {
    return param;
  }
}

export const stringifyJSON = function (obj) {
  let result;
  try {
    result = JSON.stringify(obj);
  } catch (errr) {
    result = ""
  }
  return result;
}

export const toastWithLog = function (str) {
  if (isBrDevelopment && typeof str === "string" && str.startsWith("Config Decode Failed")) {
    // Decoding and original local defaults are unchanged. Retain every diagnostic,
    // but do not enqueue a new debugging toast for each field on every keystroke.
    console.error(str);
    if (!brConfigurationNoticeShown) {
      brConfigurationNoticeShown = true;
      window.JBridge.toast("Configuração legada incompleta. Detalhes no log.");
    }
    return;
  }
  const JOSFlags = window.JOS.getJOSflags()
  if (JOSFlags.isCUGUser || isDebug) {
    if (window.__OS == "IOS") {
      // window.JBridge.toast(str); //remove once toast is fixed in iOS.
    } else {
      window.JBridge.toast(str);
    }
  }
  console.error(str);
};

export const unsafeSetForeign = function (key,obj,value) {
  if (typeof obj === "string") {
    obj = {}
  }
  obj[key] = value;
  return obj;
};

export const unsafeGet = function (key,obj) {
  return obj[key];
};

export const unsafeHas = function (key,obj) {
  return obj[key] !== undefined && obj[key] !== null;
};


export const storeFiber = (fiber) => {
  return  () => {
    fibers.push(fiber);
  }
};

export const getFibers = () => {
  return () => {
    return fibers;
  }
};

export const resetFibers = () => {
  return () => {
    fibers = [];
  }
};
