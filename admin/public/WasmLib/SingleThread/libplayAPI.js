let SDKModule;

const VIDEO_FRAME_SUB_TYPE_I = 0;					//I帧
const VIDEO_FRAME_SUB_TYPE_P = 1;					//P帧
const VIDEO_FRAME_SUB_TYPE_B = 2;					//B帧
const VIDEO_FRAME_SUB_TYPE_SMART_I = 18;			//智能I帧
const VIDEO_FRAME_SUB_TYPE_SMART_P = 19;			//智能P帧
const VIDEO_FRAME_SUB_TYPE_SMART_I_NORENDER = 20;	//智能I帧，但不显示

const ENCODE_TYPE_VIDEO_HI_H264 = 2;	//海思H.264编码格式
const ENCODE_TYPE_VIDEO_MY_H264 = 4;	//公司H.264编码格式
const ENCODE_TYPE_VIDEO_STD_H264 = 8;	//标准H.264编码格式
const ENCODE_TYPE_VIDEO_H265 = 12;		//H.265编码格式

const DATA_RECORD_MP4 = 5;				//录制MP4格式

const SP_STREAM_TYPE_DHSTD = 8;			//dav编码格式
const STREAM_TYPE_SVC = 13;				//H.264 SVC编码格式
const SP_STREAM_TYPE_FLV = 18;			//flv编码格式

const ENCRYPT_UNKOWN = 0;				//未知加密类型
const ENCRYPT_AES = 1;					//AES加密类型，16进制数组格式
const ENCRYPT_AES256 = 2;				//AES256加密类型，16进制数组格式
const ENCRYPT_AES_STRING_FORMAT = 3;	//AES加密类型，字符串格式

const CACHE_MODE_OFF = 0;				//关闭实时流自适应缓冲模式
const ADAPTIVE_CACHE = 1;				//自适应缓冲
const REALTIME_FIRST = 2;				//实时优先
const FLUENCY_FIRST = 3;				//流畅优先 