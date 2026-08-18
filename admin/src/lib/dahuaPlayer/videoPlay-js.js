import { checkBrowser } from './playerWasm/public.js';
import PlayerControl from './playerWasm/PlaySDKInterface.js';

const loadScript = (src, callback) => {
  const dom = document.createElement('script');
  dom.src = src;
  document.head.appendChild(dom);
  var loaded = false;
  if (typeof callback === 'function') {
    dom.onload = dom.onreadystatechange = function () {
      if (
        !loaded &&
        (!dom.readyState || /loaded|complete/.test(dom.readyState))
      ) {
        dom.onload = dom.onreadystatechange = null;
        loaded = true;
        callback();
      }
    };
  }
};

let m_bClientInitialized = false;
let m_nModuleInitialized = false;

// Load multi-threaded PlaySDK library files
const loadLibPlaySDK = () => {
  const libPath = '/WasmLib/MultiThread/libplay.js';
  if (!isInclude('MultiThread/libplay.js')) {
    loadScript(libPath, null);
  }
};

// Load multi-threaded streaming library files
const loadLibStreamClient = () => {
  let libPath = '/WasmLib/MultiThread/libStreamClient.js';
  if (!isInclude('MultiThread/libStreamClient.js')) {
    loadScript(libPath, () => {
      // Initialize Streaming Module
      Multi_Client_Module().then((instance) => {
        window.SCModule = instance;
        // Multiple channels only need to be initialized once
        window.SCModule._GLOBAL_Init();
        m_bClientInitialized = true;
      });
    });
  }
};

// Load rendering engine files
const loadLibRenderEngine = () => {
  let libPath = '/WasmLib/Common/libRenderEngine.js';
  if (!isInclude('Common/libRenderEngine.js')) {
    loadScript(libPath, () => {
      // Initialize rendering engine module
      RenderEngine_Module().then((instance) => {
        window.REModule = instance;
      });
    });
  }
};

// Load IVSdrawer file
const loadLibIVSDrawer = () => {
  let libPath = '/WasmLib/Common/libIVSDrawer.js';
  if (!isInclude('Common/libIVSDrawer.js')) {
    loadScript(libPath, () => {
      // Initialize IVSDrawer Module
      IVSDrawer_Module().then((instance) => {
        window.IVSModule = instance;
      });
    });
  }
};

const loadLibASPLite = () => {
  let libPath = '/WasmLib/Common/libmavasp_litepacket.js';
  let dataPath = '/WasmLib/Common/libmavasp_litepacket.data';
  if (!isInclude('Common/libmavasp_litepacket.js')) {
    loadScript(libPath, () => {
      // Set the path to the libmavasp_litepacket.data configuration file
      ASPLite_Module['locateFile'] = function (path, prefix) {
        if (path.endsWith('.data')) {
          return dataPath;
        }
        return prefix + path;
      };
      // Initialize ASPLite Module
      ASPLite_Module(ASPLite_Module).then((instance) => {
        window.ASPLiteModule = instance;
      });
    });
  }
};

if (!window.Module) {
  window.Module = {};
}

// PlaySDK wasm module loading and initialization completed callback
Module.onRuntimeInitialized = function () {
  m_nModuleInitialized = true;
};
// Reset font file path
Module.locateFile = function (path, prefix) {
  if (path.endsWith('.data')) {
    return '/WasmLib/MultiThread/libplay.data';
  }
  return prefix + path;
};

const isInclude = (name) => {
  var js = /js$/i.test(name);
  var es = document.getElementsByTagName(js ? 'script' : 'link');
  for (var i = 0; i < es.length; i++) {
    if (es[i][js ? 'src' : 'href'].indexOf(name) != -1) return true;
  }
  return false;
};

const loadLibDHPlay = (bSupportMultiThread) => {
  if (bSupportMultiThread) {
    loadLibPlaySDK();
    // Multi threaded version, using StreamClient wasm module for streaming
    loadLibStreamClient();
  }

  if (!bSupportMultiThread) {
    loadLibRenderEngine();
  }
  loadLibIVSDrawer();
  // Load 3A algorithm library
  loadLibASPLite();

  let timer = null;
  return new Promise((resolve) => {
    timer = setInterval(() => {
      if (
        !bSupportMultiThread ||
        (m_nModuleInitialized && m_bClientInitialized)
      ) {
        clearInterval(timer);
        resolve();
      }
    });
  });
};

class Player {
  constructor(ids, callbacks) {
    this.ids = ids || [];
    this.playControls = {};
    this.nPorts = {};
    this.volumes = {};
    this.talkVolumes = {};
    this.playStatus = {};
    this.recordingStatus = {};
    this.timers = {};
    this.downloadTimers = {};
    this.playError = callbacks.playError ? callbacks.playError : () => {};
    this.playFileOver = callbacks.playFileOver
      ? callbacks.playFileOver
      : () => {};
    this.captureCallback = callbacks.captureCallback
      ? callbacks.captureCallback
      : () => {};
    this.playStart = callbacks.playStart ? callbacks.playStart : () => {};
    this.playProgressUpdate = callbacks.playProgressUpdate
      ? callbacks.playProgressUpdate
      : () => {};
    this.talkError = callbacks.talkError ? callbacks.talkError : () => {};
    this.downloadError = callbacks.downloadError
      ? callbacks.downloadError
      : () => {};
    this.downloadComplete = callbacks.downloadComplete
      ? callbacks.downloadComplete
      : () => {};
    this.videoDownloadDuration = callbacks.videoDownloadDuration
      ? callbacks.videoDownloadDuration
      : () => {};
    this.downloadProgressUpdate = callbacks.downloadProgressUpdate
      ? callbacks.downloadProgressUpdate
      : () => {};
    this.runtimeInitializedCallBack = callbacks.runtimeInitializedCallBack
      ? callbacks.runtimeInitializedCallBack
      : null;
  }

  /**
   * @param { Array } ids Play window id collection
   */
  async init() {
    if (!this.ids) return;
    if (!Array.isArray(this.ids)) this.ids = [this.ids];
    this.ids.forEach((id) => {
      this.playControls[id] = {};
      this.drawVideoDom(id);
    });
    window.cPlusVisibleDecCallBack = (
      nPort,
      pBufY,
      pBufU,
      pBufV,
      nSize,
      pFrameInfo,
    ) => {
      this.ids.forEach((id) => {
        if (this.nPorts[id] && this.nPorts[id].playerPort == nPort) {
          this.playControls[id].player &&
            this.playControls[id].player.SetFrameData(
              nPort,
              pBufY,
              pBufU,
              pBufV,
              nSize,
              pFrameInfo,
              this.volumes[id],
            );
          return true;
        } else if (this.nPorts[id] && this.nPorts[id].talkPort == nPort) {
          this.playControls[id].talkPlayer &&
            this.playControls[id].talkPlayer.SetFrameData(
              nPort,
              pBufY,
              pBufU,
              pBufV,
              nSize,
              pFrameInfo,
              this.talkVolumes[id],
              true,
            );
          return true;
        } else if (
          this.nPorts[id] &&
          this.nPorts[id].downloadPlayerPort == nPort
        ) {
          this.playControls[id].downloadPlayer &&
            this.playControls[id].downloadPlayer.SetFrameData(
              nPort,
              pBufY,
              pBufU,
              pBufV,
              nSize,
              pFrameInfo,
              0,
            );
          return true;
        }
      });
    };
    window.cDigitalSignCallBack = (nPort, nFrameID, bSuccess) => {
      this.ids.forEach((id) => {
        if (this.nPorts[id] && this.nPorts[id].playerPort == nPort) {
          this.playControls[id].player &&
            this.playControls[id].player.SetDecryptionResult(
              nPort,
              nFrameID,
              bSuccess,
            );
        } else if (
          this.nPorts[id] &&
          this.nPorts[id].downloadPlayerPort == nPort
        ) {
          this.playControls[id].downloadPlayer &&
            this.playControls[id].downloadPlayer.SetDecryptionResult(
              nPort,
              nFrameID,
              bSuccess,
            );
        }
      });
    };

    window.cExtraDrawDataCallBack = (nPort, nDataType, pDrawData, nDataLen) => {
      this.ids.forEach((id) => {
        if (this.nPorts[id] && this.nPorts[id].playerPort == nPort) {
          this.playControls[id].player &&
            this.playControls[id].player.setIVSData(
              nPort,
              nDataType,
              pDrawData,
              nDataLen,
            );
        } else if (
          this.nPorts[id] &&
          this.nPorts[id].downloadPlayerPort == nPort
        ) {
          this.playControls[id].downloadPlayer &&
            this.playControls[id].downloadPlayer.setIVSData(
              nPort,
              nDataType,
              pDrawData,
              nDataLen,
            );
        }
      });
    };

    window.cExtraDrawDrawCallBack = (nPort) => {
      this.ids.forEach((id) => {
        if (this.nPorts[id] && this.nPorts[id].playerPort == nPort) {
          this.playControls[id].player &&
            this.playControls[id].player.drawIVSData(nPort);
        } else if (
          this.nPorts[id] &&
          this.nPorts[id].downloadPlayerPort == nPort
        ) {
          this.playControls[id].downloadPlayer &&
            this.playControls[id].downloadPlayer.drawIVSData(nPort);
        }
      });
    };

    window.cRecordDataCallBack = (
      nPort,
      pData,
      nDataLen,
      nOffset,
      pRecordFrameInfo,
    ) => {
      this.ids.forEach((id) => {
        if (this.nPorts[id] && this.nPorts[id].playerPort == nPort) {
          this.playControls[id].player &&
            this.playControls[id].player.SetRecordData(
              nPort,
              pData,
              nDataLen,
              nOffset,
              pRecordFrameInfo,
            );
        } else if (
          this.nPorts[id] &&
          this.nPorts[id].downloadPlayerPort == nPort
        ) {
          this.playControls[id].downloadPlayer &&
            this.playControls[id].downloadPlayer.SetRecordData(
              nPort,
              pData,
              nDataLen,
              nOffset,
              pRecordFrameInfo,
            );
        }
      });
    };

    window.cIVSDrawDataCallBack = (nPort, buf, type, len, reallen) => {
      this.ids.forEach((id) => {
        if (this.nPorts[id] && this.nPorts[id].playerPort == nPort) {
          this.playControls[id].player &&
            this.playControls[id].player.SetIVSDrawData(
              nPort,
              buf,
              type,
              len,
              reallen,
            );
        } else if (
          this.nPorts[id] &&
          this.nPorts[id].downloadPlayerPort == nPort
        ) {
          this.playControls[id].downloadPlayer &&
            this.playControls[id].downloadPlayer.SetIVSDrawData(
              nPort,
              buf,
              type,
              len,
              reallen,
            );
        }
      });
    };

    window.cPlusMediaFrameCallBack = (handle, index, pData, nDataLength) => {
      this.ids.forEach((id) => {
        if (this.nPorts[id] && this.nPorts[id].playerHandle == handle) {
          this.playControls[id].player &&
            this.playControls[id].player.InputDataEx(pData, nDataLength);
        } else if (this.nPorts[id] && this.nPorts[id].talkHandle == handle) {
          this.playControls[id].talkPlayer &&
            this.playControls[id].talkPlayer.InputDataEx(pData, nDataLength);
        } else if (
          this.nPorts[id] &&
          this.nPorts[id].downloadHandle == handle
        ) {
          this.playControls[id].downloadPlayer &&
            this.playControls[id].downloadPlayer.InputDataEx(
              pData,
              nDataLength,
            );
        }
      });
    };

    window.cPlusRtspMsgCallBack = (handle, type, attach) => {
      this.ids.forEach((id) => {
        let playerHandle = null;
        let player = null;
        if (this.nPorts[id] && this.nPorts[id].playerHandle == handle) {
          playerHandle = this.nPorts[id].playerHandle;
          player = this.playControls[id].player;
        } else if (this.nPorts[id] && this.nPorts[id].talkHandle == handle) {
          playerHandle = this.nPorts[id].talkHandle;
          player = this.playControls[id].talkPlayer;
        } else if (
          this.nPorts[id] &&
          this.nPorts[id].downloadHandle == handle
        ) {
          playerHandle = this.nPorts[id].downloadHandle;
          player = this.playControls[id].downloadPlayer;
        }
        if (playerHandle && player) {
          switch (type) {
            // The module responsible for handling the RTSP protocol flow, if it fails during RTSP processing, sends the message to the message receiver
            // Upon receiving this message, the recipient should call Close() to close the client. The attached parameter attach to the message is not used
            case 0x1000:
              player.StreamFailedCallback(attach);
              player.StopPullStream();
              player.StreamDisconnectCallback();
              break;
            // Indicates that the client has completed the initialization and setup steps for the peer, and at this point, the user can obtain the SDP,
            // The attached parameter attach to the message is not used.
            // RTSP_PutStream can only be called after receiving this message in intercom services
            case 0x1001:
              break;
            // Indicates that all streams on the server have been received and the receiver should call Close() to clean up resources
            // The attached parameter attach to the message is not used.
            case 0x1004:
              player.StreamFinishCallback();
              break;
            // RTSP redirect message, when the client has configured clientConfigRedirDisable to enable, it will notify the upper layer of the message,
            // Implement redirection function from the upper layer
            case 0x1008:
              player.StreamRedirectCallback(attach);
              break;
          }
        }
      });
    };

    window.cPlusRtsvMsgCallBack = (handle, type) => {
      this.ids.forEach((id) => {
        let playerHandle = null;
        let player = null;
        if (this.nPorts[id] && this.nPorts[id].playerHandle == handle) {
          playerHandle = this.nPorts[id].playerHandle;
          player = this.playControls[id].player;
        } else if (this.nPorts[id] && this.nPorts[id].talkHandle == handle) {
          playerHandle = this.nPorts[id].talkHandle;
          player = this.playControls[id].talkPlayer;
        } else if (
          this.nPorts[id] &&
          this.nPorts[id].downloadHandle == handle
        ) {
          playerHandle = this.nPorts[id].downloadHandle;
          player = this.playControls[id].downloadPlayer;
        }
        if (playerHandle) {
          switch (type) {
            case 0x4001:
              // Only after receiving this message in the intercom business can RTSV-PutStream be called
              break;
            case 0x4002:
              player.StreamFinishCallback();
              break;
          }
        }
      });
    };

    Module.onRuntimeInitialized = function () {
      m_nModuleInitialized = true;
      this.runtimeInitializedCallBack && this.runtimeInitializedCallBack();
    };

    const { bSupportMultiThread } = checkBrowser();
    if (!isInclude('/libplay.js')) {
      await loadLibDHPlay(bSupportMultiThread);
    }
  }

  drawVideoDom(id) {
    const dom = document.querySelector(`#${id}`);
    let videoDom = `
    <div class="video-player-context" style="width: 100%; height: 100%; position: relative;">
      <canvas
        id="download-${id}"
        class="kind-stream-canvas video-player-canvas"
        kind-channel-id="0"
        width="1920"
        height="1080"
        style="visibility: hidden; position: absolute; top: 0; width: 100%; height: 100%; object-fit: fill;"
      ></canvas>
      <canvas
        id="downloadIvs-${id}"
        class="kind-stream-canvas video-player-canvas"
        width="1920"
        height="1080"
        style="visibility: hidden; position: absolute; top: 0; width: 100%; height: 100%; object-fit: fill;"
      ></canvas>
      <canvas
        id="talk-${id}"
        class="kind-stream-canvas video-player-canvas"
        kind-channel-id="0"
        width="1920"
        height="1080"
        style="visibility: hidden; position: absolute; top: 0; width: 100%; height: 100%; object-fit: fill;"
      ></canvas>
      <canvas
        id="talkIvs-${id}"
        class="kind-stream-canvas video-player-canvas"
        width="1920"
        height="1080"
        style="visibility: hidden; position: absolute; top: 0; width: 100%; height: 100%; object-fit: fill;"
      ></canvas>
      <canvas
        id="can-${id}"
        class="kind-stream-canvas video-player-canvas"
        kind-channel-id="0"
        width="1920"
        height="1080"
        style="visibility: hidden; position: absolute; top: 0; width: 100%; height: 100%; object-fit: fill;"
      ></canvas>
      <canvas
        id="ivsCan-${id}"
        class="kind-stream-canvas video-player-canvas"
        width="1920"
        height="1080"
        style="visibility: hidden; position: absolute; top: 0; width: 100%; height: 100%; object-fit: fill;"
      ></canvas>
      <video
        id="video-${id}"
        class="kind-stream-canvas"
        kind-channel-id="0"
        width="1920"
        height="1080"
        style="visibility: hidden; width: 100%; height: 100%; top: 0; object-fit: fill;"
      ></video>
      <video
        id="download-video-${id}"
        class="kind-stream-canvas"
        kind-channel-id="0"
        width="1920"
        height="1080"
        style="visibility: hidden; width: 100%; height: 100%; top: 0; object-fit: fill;"
      ></video>
      <video
        id="talk-video-${id}"
        class="kind-stream-canvas"
        kind-channel-id="0"
        width="1920"
        height="1080"
        style="visibility: hidden; width: 100%; height: 100%; top: 0; object-fit: fill;"
      ></video>
      <img src="/360ARTagAsserts/loading.gif" id="loading-${id}" style="display: none; width: 286px; height: 180px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);" />
    </div>
    `;
    if (dom) dom.innerHTML = videoDom;
  }

  /**
   * @description play
   * @param { string } id play window id
   * @param { object } options parameters to play
   */
  play(id, options) {
    if (!options.streamURL) return;
    if (this.playControls[id] && this.playControls[id].player) {
      this.close(id);
    }
    const {
      isPrivateProtocol,
      wsURL,
      stream,
      sourceId,
      deviceId,
      userName,
      password,
      npt,
      open3DPoint,
      encryptMode,
      encryptSecret,
      isSandardPack,
      volume,
    } = this.parameterProcessing(options);
    this.volumes[id] = volume;
    const initParam = {
      canvasElem: document.querySelector(`#can-${id}`),
      videoElem: document.querySelector(`#video-${id}`),
      ivsCanvasElem: document.querySelector(`#ivsCan-${id}`),
      bPlayBack: options.isLive === false,
      strDecodeFilePath: '/WasmLib/SingleThread',
    };
    const urlParam = {
      strRtspvUri: wsURL,
      strRtspvUrl: stream,
      strPlayToken: '',
      strPlayTokenKey: '',
      strDeviceID: deviceId,
      strSourceId: isPrivateProtocol ? sourceId : '',
      strUserName: userName,
      strPassWord: password,
      bTalkService: false,
      nRange: npt,
      nShortTimeout: 3,
      nRtspResponseTimeout: 8,
      bStandardPack: isSandardPack,
    };
    const { bSupportMultiThread } = checkBrowser();
    if (!this.playControls[id]) this.playControls[id] = {};
    if (!this.nPorts[id]) this.nPorts[id] = {};
    this.playControls[id].player = new PlayerControl(bSupportMultiThread);
    const player = this.playControls[id].player;
    const loadingElement = document.querySelector(`#loading-${id}`);
    if (loadingElement) {
      loadingElement.style.display = 'block';
    }
    player.SetCallBack('StreamPlayOver', () => {
      if (this.playControls[id].player) {
        setTimeout(() => {
          this.close(id);
          this.playFileOver(id);
        }, 1);
      }
    });
    player.SetCallBack('PlayStart', () => {
      this.playStatus[id] = true;
      // Define the ID for easier reference
      const elementId = `#can-${id}`;
      const ivsElementId = `#ivsCan-${id}`;
      const videoElementId = `#video-${id}`;
      const loadingElementId = `#loading-${id}`;

      // Check if the elements exist before applying styles
      const canElement = document.querySelector(elementId);
      const ivsCanElement = document.querySelector(ivsElementId);
      const videoElement = document.querySelector(videoElementId);
      const loadingElement = document.querySelector(loadingElementId);

      if (canElement) {
        canElement.style.visibility = 'visible';
      }

      if (ivsCanElement) {
        ivsCanElement.style.visibility = 'visible';
      }

      if (videoElement) {
        videoElement.style.visibility = 'visible';
      }

      if (loadingElement) {
        loadingElement.style.display = 'none';
      }

      this.playStart();
    });
    player.SetCallBack('CaptureChanged', (blob) => {
      this.captureCallback(id, blob);
    });
    player.SetCallBack('VideoFrameInfo', (e) => {
      if (e.timeStamp) {
        clearTimeout(this.timers[id]);
        this.timers[id] = setTimeout(() => {
          this.playError(id, {
            errorCode: '409',
            errMsg: 'Rtsp Not Response.',
          });
        }, 10000);
      }
      const msg = {
        frameRate: e.nFrameRate,
        time: e.timeStamp,
        utcTime: e.utcTimeStamp,
      };
      this.playProgressUpdate(id, msg);
    });

    player.SetCallBack('DecodeStart', (e) => {
      if (e.decodeMode === 'video') {
        const canElement = document.querySelector(`#can-${id}`);
        if (canElement) {
          canElement.style.display = 'none';
        }
        const videoElement = document.querySelector(`#video-${id}`);
        if (videoElement) {
          videoElement.style.display = '';
        }
      } else {
        const canElement = document.querySelector(`#can-${id}`);
        if (canElement) {
          canElement.style.display = '';
        }
        const videoElement = document.querySelector(`#video-${id}`);
        if (videoElement) {
          videoElement.style.display = 'none';
        }
      }
    });
    player.SetCallBack('Error', (e) => {
      this.playStatus[id] = false;

      const elementId = `#can-${id}`;
      const ivsElementId = `#ivsCan-${id}`;
      const videoElementId = `#video-${id}`;
      const loadingElementId = `#loading-${id}`;

      // Check if the elements exist before applying styles
      const canElement = document.querySelector(elementId);
      const ivsCanElement = document.querySelector(ivsElementId);
      const videoElement = document.querySelector(videoElementId);
      const loadingElement = document.querySelector(loadingElementId);

      if (canElement) {
        canElement.style.visibility = 'hidden';
      }

      if (ivsCanElement) {
        ivsCanElement.style.visibility = 'hidden';
      }

      if (videoElement) {
        videoElement.style.visibility = 'hidden';
        videoElement.style.display = 'none';
      }

      if (loadingElement && loadingElement.style.display == 'block') {
        loadingElement.style.display = 'none';
      }

      this.playError(id, e);
    });
    player.SetCallBack('GetPlayPort', (port) => {
      this.nPorts[id].playerPort = port;
    });
    player.SetCallBack('GetOriginalKey', ({ nRet, outKey }) => {
      if (nRet == 1) {
        urlParam.strDeviceID = outKey;
        this.nPorts[id].playerHandle = player.StartPullStream(
          JSON.parse(JSON.stringify(urlParam)),
        );
      }
    });
    // player.SetPrintLogLevel(6)
    player.Init(initParam);
    player.SetSoundState(true);
    player.SetVolume(this.volumes[id]);
    player.Set3DPoint(open3DPoint);
    if (!!encryptMode) {
      player.GetOriginalKey({
        strPlayToken: '',
        strPlayTokenKey: '',
        strDeviceID: deviceId,
      });
    } else {
      this.nPorts[id].playerHandle = player.StartPullStream(
        JSON.parse(JSON.stringify(urlParam)),
      );
    }
  }

  /**
   * @description download
   * @param { string } id download window id
   * @param { object } options parameters to download
   * @param { string } fileName file name
   * @param { number } speed download speed
   */
  download(id, options, fileName, speed = 2) {
    if (!options.streamURL) return;
    if (this.playControls[id] && this.playControls[id].downloadPlayer) {
      this.playControls[id].downloadPlayer.StopRecord();
      this.playControls[id].downloadPlayer.StopPullStream();
      this.playControls[id].downloadPlayer.Stop();
      this.playControls[id].downloadPlayer = null;
    } else {
      if (!this.volumes[id] && this.volumes[id] !== 0) {
        this.volumes[id] = 1;
      }
      const {
        isPrivateProtocol,
        wsURL,
        stream,
        sourceId,
        deviceId,
        userName,
        password,
        npt,
        open3DPoint,
        encryptMode,
        encryptSecret,
        isSandardPack,
      } = this.parameterProcessing(options);
      const initParam = {
        canvasElem: document.querySelector(`#download-${id}`),
        videoElem: document.querySelector(`#download-video-${id}`),
        ivsCanvasElem: document.querySelector(`#downloadIvs-${id}`),
        bPlayBack: options.isLive === false,
        strDecodeFilePath: '/WasmLib/SingleThread',
      };
      const urlParam = {
        strRtspvUri: wsURL,
        strRtspvUrl: stream,
        strPlayToken: '',
        strPlayTokenKey: '',
        strDeviceID: deviceId,
        strSourceId: isPrivateProtocol ? sourceId : '',
        strUserName: userName,
        strPassWord: password,
        bTalkService: false,
        nRange: npt,
        nShortTimeout: 3,
        nRtspResponseTimeout: 8,
        bStandardPack: isSandardPack,
      };
      const { bSupportMultiThread } = checkBrowser();
      if (!this.playControls[id]) this.playControls[id] = {};
      if (!this.nPorts[id]) this.nPorts[id] = {};
      let isSpeed = false;
      this.playControls[id].downloadPlayer = new PlayerControl(
        bSupportMultiThread,
      );
      let downloadPlayer = this.playControls[id].downloadPlayer;
      downloadPlayer.SetCallBack('Error', (e) => {
        this.downloadError(id, e);
      });
      downloadPlayer.SetCallBack('StreamPlayOver', () => {
        downloadPlayer.StopRecord();
        this.downloadComplete(id);
        this.playControls[id].downloadPlayer = null;
      });
      downloadPlayer.SetCallBack('Disconnect', (e) => {
        downloadPlayer.StopRecord();
        this.downloadError(id, e);
        this.playControls[id].downloadPlayer = null;
      });
      downloadPlayer.SetCallBack('PlayBackStreamRange', (time) => {
        this.videoDownloadDuration(id, time);
      });
      downloadPlayer.SetCallBack('RecordTimeStamp', (e) => {
        if (!isSpeed && speed && e.timeStamp) {
          isSpeed = true;
          downloadPlayer.SetSpeed(speed);
        }
        if (e.timeStamp) {
          clearTimeout(this.downloadTimers[id]);
          this.downloadTimers[id] = setTimeout(() => {
            this.downloadError(id, {
              errorCode: '409',
              errMsg: 'Rtsp Not Response.',
            });
          }, 10000);
        }
        const msg = {
          size: e.size,
          time: e.timeStamp,
          utcTime: e.utcTimeStamp,
        };
        this.downloadProgressUpdate(id, msg);
      });
      downloadPlayer.SetCallBack('GetPlayPort', (port) => {
        this.nPorts[id].downloadPlayerPort = port;
      });
      downloadPlayer.SetCallBack('GetOriginalKey', ({ nRet, outKey }) => {
        if (nRet == 1) {
          urlParam.strDeviceID = outKey;
          this.nPorts[id].downloadHandle = downloadPlayer.StartPullStream(
            JSON.parse(JSON.stringify(urlParam)),
          );
          downloadPlayer.StartRecord(5, 1000, fileName || Date.now() + '.mp4');
        }
      });
      downloadPlayer.Init(initParam);
      downloadPlayer.Set3DPoint(open3DPoint);
      if (!!encryptMode) {
        downloadPlayer.GetOriginalKey({
          strPlayToken: '',
          strPlayTokenKey: '',
          strDeviceID: deviceId,
        });
      } else {
        this.nPorts[id].downloadHandle = downloadPlayer.StartPullStream(
          JSON.parse(JSON.stringify(urlParam)),
        );
        downloadPlayer.StartRecord(5, 1000, fileName || Date.now() + '.mp4');
      }
    }
  }

  /**
   * @method downloadPause Pause download
   */
  downloadPause = (id) => {
    this.playControls[id].downloadPlayer &&
      this.playControls[id].downloadPlayer.Pause(1);
    clearTimeout(this.downloadTimers[id]);
  };

  /**
   * @method downloadStart Continue downloading
   */
  downloadStart = (id) => {
    this.playControls[id].downloadPlayer &&
      this.playControls[id].downloadPlayer.Pause(0);
  };

  /**
   * @method downloadClose Close Download
   */
  downloadClose = (id) => {
    this.playControls[id].downloadPlayer &&
      this.playControls[id].downloadPlayer.StopPullStream();
    this.playControls[id].downloadPlayer &&
      this.playControls[id].downloadPlayer.Stop();
    this.playControls[id].downloadPlayer.CancelRecord();
    clearTimeout(this.downloadTimers[id]);
    this.playControls[id].downloadPlayer = null;
  };

  /**
   * @description turn on smart frame
   * @param { string } id play window id
   */
  openIVS(id) {
    this.playControls[id].player && this.playControls[id].player.OpenIVS();
  }

  /**
   * @description turn off smart frame
   * @param { string } id play window id
   */
  closeIVS(id) {
    this.playControls[id].player && this.playControls[id].player.CloseIVS();
  }

  /**
   * @description intercom
   * @param { string } id play window id
   * @param { object } options parameters to play
   */
  talk(id, options) {
    if (this.playControls[id]?.talkPlayer) {
      this.playControls[id].talkPlayer.StopTalk();
      this.playControls[id].talkPlayer.StopPullStream();
      this.playControls[id].talkPlayer.Stop();
      this.playControls[id].talkPlayer = null;
    } else if (options) {
      const {
        isPrivateProtocol,
        wsURL,
        stream,
        sourceId,
        deviceId,
        userName,
        password,
        npt,
        encryptMode,
        encryptSecret,
        isSandardPack,
        volume,
      } = this.parameterProcessing(options);
      this.talkVolumes[id] = volume;
      const initParam = {
        canvasElem: document.querySelector(`#talk-${id}`),
        videoElem: document.querySelector(`#talk-video-${id}`),
        ivsCanvasElem: document.querySelector(`#talkIvs-${id}`),
        bPlayBack: options.isLive === false,
        strDecodeFilePath: '/WasmLib/SingleThread',
      };
      const urlParam = {
        strRtspvUri: wsURL,
        strRtspvUrl: stream,
        strPlayToken: '',
        strPlayTokenKey: '',
        strDeviceID: deviceId,
        strSourceId: isPrivateProtocol ? sourceId : '',
        strUserName: userName,
        strPassWord: password,
        bTalkService: true,
        nRange: npt,
        nShortTimeout: 3,
        nRtspResponseTimeout: 8,
        bStandardPack: isSandardPack,
      };
      if (!this.playControls[id]) this.playControls[id] = {};
      if (!this.nPorts[id]) this.nPorts[id] = {};
      const { bSupportMultiThread } = checkBrowser();
      this.playControls[id].talkPlayer = new PlayerControl(bSupportMultiThread);
      const talkPlayer = this.playControls[id].talkPlayer;
      // If the video is not played, it needs to be initialized first, if the video has been played first, it does not need to be initialized
      talkPlayer.SetCallBack('Error', (e) => {
        this.talkError(id, e);
      });
      talkPlayer.SetCallBack('GetPlayPort', (port) => {
        this.nPorts[id].talkPort = port;
      });
      talkPlayer.SetCallBack('GetOriginalKey', ({ nRet, outKey }) => {
        if (nRet == 1) {
          urlParam.strDeviceID = outKey;
          this.nPorts[id].talkHandle = talkPlayer.StartPullStream(
            JSON.parse(JSON.stringify(urlParam)),
          );
          talkPlayer.StartTalk(null, 0);
        }
      });
      talkPlayer.Init(initParam);
      talkPlayer.SetSoundState(true);
      talkPlayer.SetVolume(this.talkVolumes[id]);
      if (!!encryptMode) {
        talkPlayer.GetOriginalKey({
          strPlayToken: '',
          strPlayTokenKey: '',
          strDeviceID: deviceId,
        });
      } else {
        this.nPorts[id].talkHandle = talkPlayer.StartPullStream(
          JSON.parse(JSON.stringify(urlParam)),
        );
        talkPlayer.StartTalk(null, 0);
      }
    }
  }

  talkMute(id) {
    if (this.playControls[id]?.talkPlayer) {
      this.playControls[id].talkPlayer.StopTalk();
    }
  }

  talkEnabled(id) {
    if (this.playControls[id]?.talkPlayer) {
      this.playControls[id].talkPlayer.StartTalk(null, 0);
    }
  }

  /**
   * @description real time video
   * @param { string } id play window id
   * @param { String } fileName video file name
   */
  record(id, fileName) {
    if (!this.playControls[id] || !this.playControls[id].player) return;
    if (!this.recordingStatus[id]) {
      this.recordingStatus[id] = true;
      this.playControls[id].player.StartRecord(
        5,
        1000,
        fileName || Date.now() + '.mp4',
      );
    } else {
      this.recordingStatus[id] = false;
      this.playControls[id].player.StopRecord();
    }
  }

  /**
   * @description screenshot
   * @param { string } id play window id
   */
  screenshot(id) {
    this.playControls[id].player &&
      this.playControls[id].player.CapturePic(`${Date.now()}.jpg`);
  }

  /**
   * @description video off
   * @param { string } id play window id
   */
  close(id) {
    if (this.playControls[id]?.talkPlayer) {
      this.playControls[id].talkPlayer.StopTalk();
      this.playControls[id].talkPlayer.StopPullStream();
      this.playControls[id].talkPlayer.Stop();
      this.playControls[id].talkPlayer = null;
    }
    if (this.playControls[id]?.player) {
      this.playControls[id].player.StopPullStream();
      this.playControls[id].player.Stop();
    }
    this.playStatus[id] = false;
    clearTimeout(this.timers[id]);
    // Define the ID for easier reference
    const elementId = `#can-${id}`;
    const ivsElementId = `#ivsCan-${id}`;
    const videoElementId = `#video-${id}`;
    const loadingElementId = `#loading-${id}`;

    // Check if the elements exist before applying styles
    const canElement = document.querySelector(elementId);
    const ivsCanElement = document.querySelector(ivsElementId);
    const videoElement = document.querySelector(videoElementId);
    const loadingElement = document.querySelector(loadingElementId);

    if (canElement) {
      canElement.style.visibility = 'hidden';
    }

    if (ivsCanElement) {
      ivsCanElement.style.visibility = 'hidden';
    }

    if (videoElement) {
      videoElement.style.visibility = 'hidden';
      videoElement.style.display = 'none';
    }

    if (loadingElement) {
      loadingElement.style.display = 'none';
    }

    if (this.playControls[id]) this.playControls[id].player = null;
  }

  /**
   * @description sound settings
   * @param { string } id play window id
   * @param { number } val volume
   */
  setAudioVolume(id, val) {
    if (!window.webAudioPlayer) {
      let intervalId = setInterval(() => {
        if (window.webAudioPlayer) {
          window.webAudioPlayer.resume();
          clearInterval(intervalId);
        }
      });
    } else {
      window.webAudioPlayer.resume();
    }
    this.volumes[id] = val;
    this.playControls[id].player && this.playControls[id].player.SetVolume(val);
  }

  /**
   * @description sound settings
   * @param { string } id play window id
   * @param { number } val volume
   */
  setTalkVolume(id, val) {
    if (!window.webAudioPlayer) {
      let intervalId = setInterval(() => {
        if (window.webAudioPlayer) {
          window.webAudioPlayer.resume();
          clearInterval(intervalId);
        }
      });
    } else {
      window.webAudioPlayer.resume();
    }
    this.talkVolumes[id] = val;
    this.playControls[id].talkPlayer &&
      this.playControls[id].talkPlayer.SetVolume(val);
  }

  /**
   * @description pause
   * @param { string } id play window id
   */
  pause(id) {
    this.playControls[id]?.player && this.playControls[id].player?.Pause(1);
    clearTimeout(this.timers[id]);
  }

  /**
   * @description keep pulling
   * @param { string } id play window id
   */
  start(id) {
    this.playControls[id]?.player && this.playControls[id].player?.Pause(0);
  }

  /**
   * @description fast forward/rewind
   * @param { string } id play window id
   */
  playFF(id, speed) {
    this.playControls[id]?.player &&
      this.playControls[id].player?.SetSpeed(speed);
  }

  parameterProcessing(options, isTalk) {
    const isPrivateProtocol = options.streamURL.includes('rtsp://')
      ? false
      : true;
    const { protocol } = location;
    const [wsIP] = options.streamURL.replace('rtsp://', '').split('/');
    const wsURL = `${
      protocol === 'http:' && !options.streamURL.includes('8556') ? 'ws' : 'wss'
    }://${wsIP}`;
    const url = options.streamURL.includes('rtsp://')
      ? options.streamURL
      : `rtsp://${options.streamURL}`;
    let stream = '';
    if (isTalk) {
      stream = !isPrivateProtocol
        ? url
        : `/live/talk.xav?channel=${options.channelId}&subtype=${options.bitStream}`;
    } else {
      stream = !isPrivateProtocol
        ? options.isLive
          ? url
          : url.replace(
              /&beginTime=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}&endTime=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
              '',
            )
        : options.isLive
          ? `/live/realmonitor.xav?channel=${options.channelId}&subtype=${options.bitStream}`
          : `/vod/playback.xav?channel=${options.channelId}&subtype=${options.bitStream}`;
    }
    if (isPrivateProtocol) {
      const timeRangeArr =
        /&beginTime=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}&endTime=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.exec(
          url,
        );
      if (timeRangeArr) {
        const timeRange = timeRangeArr[0].replace(
          /(&beginTime=)(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(&endTime=)(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/,
          '&starttime=$2_$3_$4_$5_$6_$7&endtime_$9_$10_$11_$12_$13',
        );
        stream += timeRange;
      }
    }
    const sourceId = !isPrivateProtocol
      ? options.streamURL.replace('rtsp://', '').split('/')[1]
      : options.streamURL
          .replace('rtsp://', '')
          .split('/')[1]
          .replace(
            /&beginTime=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}&endTime=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
            '',
          );
    const userName = options.userName || 'admin';
    const password = options.password || 'admin123';
    const deviceId = options.deviceId || '';
    const encryptMode = options.encryptMode || 0;
    const encryptSecret = options.encryptSecret || '';
    const npt = options.npt || 0;
    const panoAR = options.npt || 0;
    const open3DPoint = options.open3DPoint || 0;
    const isSandardPack = options.isSandardPack || false;
    const volume = options.volume || options.volume == 0 ? options.volume : 1;
    return {
      isPrivateProtocol,
      wsURL,
      stream,
      sourceId,
      deviceId,
      userName,
      password,
      encryptMode,
      encryptSecret,
      npt,
      panoAR,
      open3DPoint,
      isSandardPack,
      volume,
    };
  }
}

export default Player;
