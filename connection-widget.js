/**
 *    ____                            _   _              __        ___     _            _         _                  ____            _       _
 *   / ___|___  _ __  _ __   ___  ___| |_(_) ___  _ __   \ \      / (_) __| | __ _  ___| |_      | | __ ___   ____ _/ ___|  ___ _ __(_)_ __ | |_
 *  | |   / _ \| '_ \| '_ \ / _ \/ __| __| |/ _ \| '_ \   \ \ /\ / /| |/ _` |/ _` |/ _ \ __|  _  | |/ _` \ \ / / _` \___ \ / __| '__| | '_ \| __|
 *  | |__| (_) | | | | | | |  __/ (__| |_| | (_) | | | |   \ V  V / | | (_| | (_| |  __/ |_  | |_| | (_| |\ V / (_| |___) | (__| |  | | |_) | |_
 *   \____\___/|_| |_|_| |_|\___|\___|\__|_|\___/|_| |_|    \_/\_/  |_|\__,_|\__, |\___|\__|  \___/ \__,_| \_/ \__,_|____/ \___|_|  |_| .__/ \__|
 *                                                                           |___/                                                    |_|
 *
 *  @author Brayden Aimar
 */

/* eslint-disable */
/* eslint-disable padded-blocks */
/* eslint-disable quote-props */
/* eslint-disable object-shorthand */
/* eslint-disable prefer-const */
/* eslint-disable no-console */
/* eslint-disable func-names */
/* eslint-disable no-continue */

define([ 'jquery' ], $ => ({

	// id - must match the widget name (the name given to this file).
	id: 'connection-widget',
	// name - The moniker that appears in the top left-hand corner ow the app.
	name: 'Terminal',
	// shortName - The moniker that appears on the widget's button on the right-hand side of the app.
	shortName: 'Terminal',
	// btnTheme - The theme used for the widget's button on the right-hand side of the app.
	btnTheme: 'default',
	// btnTheme: 'warning',
	// icon - The icon that appears on the widget's button on the right-hand side of the app.
	icon: 'fa fa-terminal', // fa-usb
	desc: 'The connection widget handles the automated-based process of connecting to the JSON server and the controller hardware board via a websocket. It also handles the sending and receiving of data to and from the controller board via the websocket connection. The data to be sent is received via pub/sub events. The received data from the SPJS and connected ports is broadcasted in publish calls.',
	publish: {
		'/main/widget-loaded': '',
		'/statusbar-widget/add': ''
	},
	subscribe: {
		'/main/all-widgets-loaded': '',
		'/main/window-resize': '',
		'/main/widget-visible': '',
		'/spjs-send [cmd]': 'Sends message directly to SPJS. Do not use this for sending data to specific ports, for that use \'/port-send\', \'/port-sendnobuf\', or \'/port-sendjson\'.',
		'/port-send [port] [cmd]': 'Sends message to connected port on the SPJS as \'send [port] [cmd]\'.',
		'/port-sendnobuf [port] [cmd]': 'Sends message to connected port on the SPJS as \'sendnobuf [port] [cmd]\'.',
		'/port-sendjson [port] [cmd] [id]': 'Sends message to connected port on the SPJS as \'sendjson { P: [port], D: {[ Data: [cmd], Id: [id] ], [ Data: [cmdn], Id: [id]n ]} }\'.',
		'/port-sendjson [port] [ [cmd], [cmd1], ..., [cmdn] ] [id]': 'Sends message to specified port on the SPJS as \'sendjson { P: [port], D: {[ Data: [cmd], Id: [id]-0 ], [ Data: [cmdn], Id: [id]-1 ]} }\'.'
	},
	foreignPublish: {},
	foreignSubscribe: {},

	// The widgetDom array stores the info needed to resize the widget elements.
	// Ex. [['container element', 'element to get size of', 'element to get size of', 'element to change size of']],
	widgetDom: [
		[ '.widget-container', ' .splist-panel', ' .console-log-panel' ],
		[ ' .console-log-panel', ' .panel-heading', ' .panel-footer', ' .panel-body' ],
		[ ' .console-log-panel .panel-body', ' .console-log-output' ]
	],
	// widgetDom: [],
	// widgetVisible stores the visible or hidden state of the widget.
	widgetVisible: false,

	// Stores information required to connect to and communicate with the SPJS WebSocket.
	// IDEA: Restructure the shit outta this stuff.
	SPJS: {
		// Stores the WebSocket connection to the Serial Port JSON Server.
		go: null,
		// Stores the WebSocket connection to the GPIO JSON Server.
		gpio: null,
		// Stores the WebSocket object.
		ws: null,
		// Stores the current state of the WebSocket to prevent unnecessary DOM updates.
		wsState: null,
		// Stores the SPJS software version.
		version: null,
		commands: [],
		hostname: null,
		// Stores information on each available port in the SPJS.
		// Ex. { COM5: {...}, COM7: {...}, COM9: {...}, COM10: {...} }
		portList: {},
		// The portMeta object stores the meta data for the each port on the SPJS.
		// Ex. [{ metaIndex: null, Name: null, Friendly: null, Baud: null, Buffer: null, muteRelatedPort: null, portMuted: null }]
		portMeta: {},
		// If there are no differences in the portListDiffs => undefined.
		// Ex. { added: [ "COM5", "COM7", "COM9", "COM10" ], opened: [ "COM5", "COM10" ] }
		// Ex. Port: added / removed / opened / closed / feedrate
		// Ex. SPJS: [ no list -> list / list -> no list ]
		portListDiffs: {},
		// The openPorts object stores the names of the ports that are open.
		// Ex. ["COM5", "COM10"]
		openPorts: [],
		/**
		 *  Enable the gpio websocket tcp server when the host is a Raspberry Pi.
		 *  @default Overwritten by settings cson file.
		 *  @type {Boolean}
		 */
		launchGpioServerOnLinux: false,
		/**
		 *  Sets the time (msec) that the program will wait between attempting to connect to the WebSocket.
		 *  If wsReconnectDelay has a value of 0, no auto reconnection attempts will be made.
		 *  @default Overwritten by settings cson file.
		 *  @type {number}
		 */
		wsReconnectDelay: 4000,
		/**
		 *  Sets if a new spjs is launched after an exit command is issued to the current spjs.
		 *  If false, a new spjs may be launched based on the setting of wsReconnectDelay.
		 *  @default Overwritten by settings cson file.
		 *  @type {Boolean}
		 */
		wsReconnectOnExitCmd: true,
		/**
		 *  Sets the time (msec) that the program will wait between getting the port list when there are no available ports.
		 *  If requestListDelay has a value of 0, no automatic list requests will be sent.
		 *  Use a value greater than approx 500ms to ensure the stability of the program.
		 *  @default Overwritten by settings cson file.
		 *  @type {number}
		 */
		requestListDelay: 4000,
		/**
		 *  Enable automatic relaunching of the Serial Port JSON Server if this process did not launch it and no devices are connected.
		 *  @default Overwritten by settings cson file.
		 *  @type {Boolean}
		 */
		exitUntrustedSpjs: true,
		/**
		 *  Keep track of how many commands are in the SPJS queue.
		 *  @type {number}
		 */
		queueCount: 0,
		/**
		 *  Keep track of wether or not buffered sending is paused.
		 *  @default Overwritten by settings cson file.
		 *  @type {Boolean}
		 */
		pauseBufferedSend: false,
		/**
		 *  Set by user to pause and resume buffering of gcode to the the SPJS.
		 *  @default Overwritten by settings cson file.
		 *  @type {Boolean}
		 */
		userPauseBufferedSend: false,
		/**
		 *  The number of lines queued in the SPJS buffer above which sending of buffered instructions will be paused.
		 *  @default Overwritten by settings cson file.
		 *  @type {number}
		 */
		pauseOnQueueCount: 40,
		/**
		 *  The number of lines queued in the SPJS buffer below which sending of buffered instructions will be resumed.
		 *  @default Overwritten by settings cson file.
		 *  @type {number}
		 */
		resumeOnQueueCount: 20,
		/**
		 *  The maximum number of instructions that can be sent to the SPJS at a time.
		 *  @default Overwritten by settings cson file.
		 *  @type {number}
		 */
		maxLinesAtATime: 8,
		/**
		 *  The minimum time [ms] between data buffered to the SPJS.
		 *  @default Overwritten by settings cson file.
		 *  @type {number}
		 */
		minWaitBetweenBufferSend: 150,
		/**
		 *  Time of the last data buffered to the SPJS. [unix time]
		 *  @type {number}
		 */
		lastBufferSendTime: 0,
		/**
		 *  Enable a feedhold command to be sent when user stops buffering gcode.
		 *  @default Overwritten by settings cson file.
		 *  @type {Boolean}
		 */
		sendFeedholdOnBufferStop: true,
		/**
		 *  The time [ms] that is waited before sending a queue flush command to a device after the feedstop command.
		 *  @default Overwritten by settings cson file.
		 *  @type {number}
		 */
		waitQueueFlushOnFeedstop: 2000,
		/**
		 *  The time [ms] that is waited before sending a cycle resume command to a device after the queue flush command.
		 *  @default Overwritten by settings cson file.
		 *  @type {number}
		 */
		waitCycleResumeOnFeedstop: 500
	},

	// TODO: Restructure the deviceMeta object.
	// newdeviceMeta: {},
	// NOTE: Loaded by cson file.
	// TODO: Change this from an array to an object and create a meta called 'default' rather than using the empty string for Vid/Pids convention.
	deviceMeta: [
		{ Friendly: 'Device Not Recognized',
			Baud: 9600,
			Buffer: 'default',
			useReceivedFriendly: true,
			autoConnectPort: false,
			portMuted: false,
			VidPids: [
				{ Vid: '', Pid: '' }
			]
		}
	],
	// If VidPids does not match portVid and portPid, assume serial device is a TinyG v8 board.
	// NOTE: Loaded by cson file.
	// TODO: Deprecate this cuz the default deviceMeta is the one with Vid/Pids as an empty string.
	defaultMetaIndex: 3,

	// Specify Friendly, Buffer, Baud, SerialNumber.
	// The first matching script will be ran. So put default scripts last.
	// NOTE: Loaded by cson file.
	initScripts: [
		{   // Arduino Uno (GRBL Board)
			'SerialNumber': 'USB\\VID_2341&PID_0043\\5533031373535160F0B2',
			'script': [
				'{sn:n}',
				'{fb:n}'
			],
			'pause': 100
		},
		{   // Punch Press TinyG
			'SerialNumber': 'FTDIBUS\\VID_0403+PID_6015+DN00Z9XLA\\0000',
			'script': [
				{ Msg: '{ec:0}', Pause: 50 }, // Expand LF to CRLF on TX [ 0 = off, 1 = on ]
				{ Msg: '{ej:1}', Pause: 50 }, // Enable JSON Mode [ 0 = text, 1 = JSON ]
				{ Msg: '{js:1}', Pause: 50 }, // JSON Serialize Style [ 0 = relaxed, 1 = strict ]
				{ Msg: '{jv:4}', Pause: 200 }, // JSON Verbosity [ 0 = silent, 1 = footer, 2 = messages, 3 = configs, 4 = linenum, 5 = verbose ]
				{ Msg: '{si:250}', Pause: 50 }, // Status Interval [ms]
				{ Msg: '{sv:1}', Pause: 50 }, // Status Report Verbosity [ 0 = off, 1 = filtered, 2 = verbose ]
				{ Msg: '{sr:{line:t,posx:t,posy:t,posz:t,vel:t,unit:t,stat:t,feed:t,coor:t,momo:t,plan:t,path:t,dist:t}}', Pause: 200 },
				// { Msg: '{qv:2}', Pause: 50 }, // Queue Report Verbosity [ 0 = off, 1 = single, 2 = tripple ]
				// { Msg: 'G17', Pause: 200 }, // XY Work Plane
				// { Msg: 'G94', Pause: 200 }, // Units per Minute Feedrate Mode
				// { Msg: 'G90', Pause: 200 }, // Absolute Distance Mode
				// { Msg: 'G21', Pause: 300 }, // Millimeters Mode
				// { Msg: '{z:{jm:230,jh:800}}', Pause: 300 }, // X-Axis Jerk Maximum
				// { Msg: '{y:{jm:15,jh:100}}', Pause: 300 }, // Y-Axis Jerk Maximum
				// { Msg: 'G20', Pause: 300 }, // Inches Mode
				{ Msg: '{z:{am:1,vm:571,fr:571,tn:0,tm:96.063,jm:9.055,jh:31.50}}', Pause: 1000 }, // X-Axis Settings jm:9, jh:31
				{ Msg: '{z:{jd:0.0020,sn:1,sx:0,sv:79,lv:8,lb:0.984,zb:0.010}}', Pause: 1000 },
				{ Msg: '{y:{am:1,vm:150,fr:150,tn:0,tm:28.346,jm:0.5906,jh:3.937}}', Pause: 1000 }, // Y-Axis Settings jm:1, jh:4
				{ Msg: '{y:{jd:0.0020,sn:1,sx:0,sv:79,lv:8,lb:0.984,zb:0.010}}', Pause: 1000 },
				{ Msg: '{2:{ma:2,sa:1.8,tr:0.5233:,mi:8,po:1,pm:3}}', Pause: 500 },
				{ Msg: '{3:{ma:1,sa:1.8,tr:1.1515,mi:8,po:1,pm:3}}', Pause: 500 },
				{ Msg: 'M08', Pause: 200 }, // Lift the Finger Solenoid
				// { Msg: 'G28.2 Y0 Z0', Pause: 2000 }, // Home Axes
				{ Msg: 'M09', Pause: 200 }, // Drop the Finger Solenoid
				// { Msg: 'G10 L2 P1 Y-3.601 Z-6.526', Pause: 200 }, // Set the G54 Work Offsets
				// { Msg: '{hp:n}', Pause: 200 }, // Request Hardware Platform
				// { Msg: '{fb:n}', Pause: 200 }, // Request Firmware Build
				{ Msg: '{sr:n}', Pause: 50 } // Request Status Report
				// { Msg: '{qr:n}', Pause: 50 } // Request Queue Report
			],
			'pause': 500
		},
		{   // Arduino Due
			'Buffer': 'tinygg2',
			'script': [
				{ Msg: '{sr:{line:t,posx:t,posy:t,posz:t,vel:t,unit:t,stat:t,feed:t,coor:t,momo:t,plan:t,path:t,dist:t,mpox:t,mpoy:t,mpoz:t}}', Pause: 200 },
				'{sv:1}', // Status Report Verbosity [ 0 = off, 1 = filtered, 2 = verbose ]
				// '{qv:2}',
				// '{jv:4}',
				// { Msg: '{sr:{line:f,posx:f,posy:f,posz:t,vel:t,unit:f,stat:f,feed:f,coor:f,momo:f,plan:f,path:f,dist:f,mpox:t,mpoy:t,mpoz:t}}', Pause: 200 },
				'{si:250}',
				'{qv:1}',
				'{jv:4}',
				'{x:{vm:40000,fr:40000,jm:200}}',
				'{y:{vm:40000,fr:40000,jm:200}}',
				'{z:{vm:20000,fr:20000,jm:100}}',
				'{hp:n}',
				'{fb:n}',
				'{sr:n}',
				'{qr:n}'
			],
			'pause': 1000
		},
		{   // TinyG
			'Buffer': 'tinyg',
			'script': [
				{ Msg: '{ec:0}', Pause: 50 }, // Expand LF to CRLF on TX [ 0 = off, 1 = on ]
				{ Msg: '{ej:1}', Pause: 50 }, // Enable JSON Mode [ 0 = text, 1 = JSON ]
				{ Msg: '{js:1}', Pause: 50 }, // JSON Serialize Style [ 0 = relaxed, 1 = strict ]
				{ Msg: '{jv:5}', Pause: 200 }, // JSON Verbosity [ 0 = silent, 1 = footer, 2 = messages, 3 = configs, 4 = linenum, 5 = verbose ]
				{ Msg: '{si:250}', Pause: 50 }, // Status Interval [ms]
				{ Msg: '{sv:1}', Pause: 50 }, // Status Report Verbosity [ 0 = off, 1 = filtered, 2 = verbose ]
				'{sr:n}'
			],
			'pause': 100
		},
		{   // Brayden's MSP430F5529
			'SerialNumber': '111D871D',
			'script': [
				'$G 0 0',
				'$G 1 1'
			],
			'pause': 1000
		}
	],

	// Sent to a device with matching info if a port is already opened to the device on the SPJS but the UI just connected to the SPJS.
	connectScripts: [
		{   // Arduino Due
			'Buffer': 'tinygg2',
			'script': [
				'{hp:n}',
				'{fb:n}',
				'{sr:n}',
				'{qr:n}'
			],
			'pause': 100
		},
		{   // TinyG
			'Buffer': 'tinyg',
			'script': [
				'{sr:n}'
			],
			'pause': 100
		}
	],

	// Stores the label and description for each status code for the tinyG controller.
	// Built on program load from the 'TinyG_Status_Codes.cson' file.
	tinygStatusMeta: {},

	// Use this to receive raw port data for a port before we get a port's 'open' message. This data gets transfered over to the port's dataRecvBuffer and this buffer is cleared once the port is officially opened.
	// Ex. { COM5: "...", COM10: "..." }
	tempDataRecvBuffer: {},
	// The dataRecvBuffer object is used to buffer raw port data as it is received so that it can be parsed into complete and individual lines of data.
	// Ex. { COM5: "...", COM10: "..." }
	dataRecvBuffer: {},

	dataSendBufferEmpty: true,
	// New data gets pushed onto the buffer and shift out items to send.
	dataSendBuffer: {},

	// IDEA: Restructure the shit outta this stuff.
	consoleLog: {
		/**
		 *  Stores the name of the currently open console log.
		 *  @type {String}
		 */
		activeLog: 'SPJS',
		/**
		 *  Stores the names of the open console logs.
		 *  Ports are sorted from smallest -> largest port number with the SPJS at the end of the list.
		 *  Ex. [ 'COM7', 'COM10', 'SPJS' ]
		 *  @type {Array}
		 */
		openLogs: [ 'SPJS' ],
		/**
		 *  Specifies the maximum number of lines to be displayed in the console log.
		 *  @default Overwritten by settings cson file.
		 *  @type {Number}
		 */
		maxLineLimit: 1000,
		/**
		 *  Specifies the minimum number of lines to be displayed in the console log.
		 *  @default Overwritten by settings cson file.
		 *  @type {Number}
		 */
		minLineLimit: 700,
		/**
		 *  Sets the time limit (ms) that an active command in the console log can be verified.
		 *  To prevent messages from being marked as stale, set this to 0.
		 *  @default Overwritten by settings cson file.
		 *  @type {number}
		 */
		staleCmdLimit: 30000,
		/**
		 *  Sets the time limit (ms) that an active command in the console log can prevent other commands of the same type from being set.
		 *  To prevent messages from being marked as stale, set this to 0.
		 *  @default Overwritten by settings cson file.
		 *  @type {number}
		 */
		staleListCmdLimit: 5000,
		/**
		 *  Enable the finding of stale commands in the console log.
		 *  @default Overwritten by settings cson file.
		 *  @type {Boolean}
		 */
		findStaleCommands: false,
		/**
		 *  The minimum number of digits that will be displayed in the line numbers in the console log.
		 *  If the length of the line number exceeds this, the number of digits used in the line number will be increased accordingly.
		 *  @default Overwritten by settings cson file.
		 *  @type {Number}
		 */
		minLineNumberDigits: 3,
		/**
		 *  Set this flag to false to prevent a port's log from being closed when the port is closed so that issues can be more easily troubleshooted.
		 *  NOTE: Only for debugging purposes.
		 *  NOTE: HIGHLY EXPERIMENTAL. This will probably cause the program to crash when port is reopened.
		 *  @type {Boolean}
		 */
		removeLogOnClose: true,
		/**
		 *  The maximum age of an unverified command that will be set to status error in the log when the SPJS closes [ms].
		 *  null - No age limit.
		 *  @default Overwritten by settings cson file.
		 *  @type {Number}
		 */
		errorCmdOnSpjsCloseMaxAge: null,
		/**
		 *  The maximum age of a command in the Spjs that can be assigned the status 'sent'.
		 *  To prevent messages from being marked as stale, set this to 0.
		 *  @default Overwritten by settings cson file.
		 *  @type {Number}
		 */
		sentSpjsCmdMaxAge: 10000,
		/**
		 *  Sets if the time to verify a given command is added beside the command in the console log as a comment.
		 *  @default Overwritten by settings cson file.
		 *  @type {Boolean}
		 */
		commentTimeToVerify: true,
		/**
		 *  Add a comment to every command to show it's id. Very useful for debugging.
		 *  @default Overwritten by settings cson file.
		 *  @type {Boolean}
		 */
		commentCmdId: true,
		/**
		 *  The delimiters to use on either side of log bot messages in the console log.
		 *  @default Overwritten by settings cson file.
		 *  @type {Array}
		 */
		logBotLineDelimiter: [ '<-- ', ' -->' ],
		/**
		 *  Set this to have the have the log bot add info about a port open event to the top of the port's console log.
		 *  @default Overwritten by settings cson file.
		 *  @type {Boolean}
		 */
		logBotOnPortOpen: true,
		/**
		 *  Set this to enable/disable the log bot messages in the port and SPJS console logs when there is a abnormal status code.
		 *  'off' - Do not the messages in any logs.
		 *  'port' - Only show the messages in the port's console log.
		 *  'spjs' - Only show the messages in the SPJS console log.
		 *  'both' - Only show the messages in both the port's and the SPJS console log.
		 *  @default Overwritten by settings cson file.
		 *  @type {String}
		 */
		logBotOnStatusCode: 'both',
		/**
		 *  Set the default line endings to be used for messages sent to ports on the SPJS.
		 *  This is over-ridden by lineEnding inside each port's respective deviceMeta object.
		 *  'NONE' - No characters will be added to the end of port messages.
		 *  'CR'   - Add a carriage-return character '\r'.
		 *  'LF'   - Add a line-feed character '\n'.
		 *  'CRLF' - Add a carriage-return and line-feed character '\r\n'.
		 *  @default Overwritten by settings cson file.
		 *  @type {String}
		 */
		defaultLineEnding: 'LF',
		/**
		 *  Define each line ending.
		 *  @default Overwritten by settings cson file.
		 *  @type {Object}
		 */
		lineEndings: {
			NONE: '',
			CR: '\\r',
			LF: '\\n',
			CRLF: '\\r\\n'
		},
		/**
		 *  Enable recursive searching of the console log for message matches.
		 *  @default Overwritten by settings cson file.
		 *  @type {Boolean}
		 */
		enableRecursiveUpdate: false,
		/**
		 *  Distance from the bottom of the panel that the panel will still automatically scroll down on.
		 *  @default Overwritten by settings cson file.
		 *  @type {number}
		 */
		autoScrollThreshold: 50,
		SPJS: {
			// The logData object stores all the messages and commands added to the console log.
			// A message would be { msg: '', type: '', line: '' }
			// A command would be { msg: '', type: '', line: '', id: '', meta: '', status: '', time: '', comment: '' }
			logData: [],
			// The cmdMap object stores the index of all command messages in the logData object.
			cmdMap: [],
			// The verifyMap object stores the index of all command messages in the logData object that still need to be verified.
			verifyMap: [],
			// Using lineCount to keep track of how many lines are in the console log and is used to make unique id for SPJS commands.
			lineCount: 0,
			// value [string] - Stores the most recent information in the respective port's <input> element. Used to fill in the text field when switching between console log tabs.
			value: '',
			// logPanelDOM - Store the JQuery DOM reference to the console log panel.
			logPanelDOM: $('#connection-widget .console-log-panel .log-SPJS'),
			// inputStatus [string] - Stores the most recent status of the respective port's <input> element. Used to correctly hilite the input field when switching between console log tabs.
			inputStatus: null,
			cmdCount: 0,
			/**
			 *  Stores all MDI (manual data input) commands.
			 *  This is used to recall previously issued commands.
			 *  @type {Array}
			 */
			history: [],
			/**
			 *  Stores the current history recall index.
			 *  null: indicates that no history recall is happening.
			 *  @type {[type]}
			 */
			historyRecallIndex: null,
			/**
			 *  The placeholder for the manual data input field.
			 *  @default Overwritten by settings cson file.
			 *  @type {String}
			 */
			placeholder: 'SPJS Command',
			/**
			 *  Enable the displaying of each type of message in the console log.
			 *  @default Overwritten by settings cson file.
			 *  @type {Object}
			 */
			msgShow: {
				default: true,
				stdout: true,
				stderr: true,
				Version: true,
				Commands: true,
				BufferAlgorithm: true,
				BaudRate: true,
				Hostname: true,
				SerialPorts: true,
				Open: true,
				OpenFail: true,
				Close: true,
				Broadcast: true,
				WipedQueue: true,
				Queued: true,
				Write: true,
				Complete: true,
				CompleteFake: true,
				Error: true,
				FeedRateOverride: true,
				RawPortData: true,
				Cayenn: true,
				GarbageCollection: true,
				GarbageHeap: true,
				ExecRuntimeStatus: true,
				ExecStatus: true,
				Command: true,
				MdiCommand: true,
				CommandEcho: true,
				LogBot: true // Messages that are create by the console log to provide the user with information on important log events.
			}
		},
		/**
		 *  Set the style of messages in the console log.
		 *  The <samp> tag has no hiliting.
		 *  The <code> tag has hilited background.
		 *  Default tag is <code>, add 'samp' to use <samp> tag.
		 *  @default Overwritten by settings cson file.
		 *  @type {Object}
		 */
		style: {
			lineWrap: false,
			default: 'text-default',
			stdout: 'samp text-muted',
			stderr: 'samp text-muted',
			Version: 'text-muted',
			Commands: 'text-muted',
			BufferAlgorithm: 'text-muted',
			BaudRate: 'text-muted',
			Hostname: 'text-muted',
			SerialPorts: 'text-muted',
			Open: 'text-success',
			OpenFail: 'text-danger',
			Close: 'text-danger',
			Broadcast: 'text-info',
			WipedQueue: 'text-success',
			Queued: 'text-warning',
			Write: 'hilite-blue',
			Complete: 'text-success',
			CompleteFake: 'text-success',
			Error: 'text-danger',
			FeedRateOverride: 'text-info',
			RawPortData: 'text-info',
			Cayenn: 'text-muted',
			GarbageCollection: 'text-muted',
			GarbageHeap: 'text-muted',
			ExecRuntimeStatus: 'text-muted',
			ExecStatus: 'text-muted',
			SpjsCommand: 'text-default', // A command sent to the spjs that is placed in the respective port's log.
			Command: 'samp text-default',
			MdiCommand: 'samp hilite-blue',	// A command that origionated at the text input field.
			CmdComment: 'samp text-muted',
			CommandEcho: 'text-default',
			LogBot: 'samp text-muted' // Messages that are create by the console log to provide the user with information on important log events.
		},
		// Command Verification Steps:
		// 1. Sent - Your Gcode has been sent to the SPJS.
		// 2. Queued - Gcode is queued inside the SPJS and waiting to be sent to the CNC controller's serial buffer.
		// 3. Written - Gcode has been written to the serial buffer of your CNC controller and removed from the SPJS's buffer.
		// 4. Completed - Gcode is completed when the CNC controller tells us it read the Gcode from it's serial buffer and placed the Gcode into it's planner buffer (this means the Gcode may only get executed seconds into the future as the planner buffer works it's way through lines).
		//    Executed (optional) - The CNC controller tells us that your Gcode was actually executed. This is the final step. On controllers like TinyG this data only comes back if line numbers are in your Gcode.
		// 	  Warning (optional)
		//    Error (optional) - The CNC controller failed to execute the line of Gcode. This could indicate a problem with your Gcode syntax, or that your CNC controller does not understand a particular Gcode command.
		// NOTE: Loaded by cson file.
		verifyStyle: {
			New: 'fa-check text-muted',
			Sent: 'fa-check text-default',
			Queued: 'fa-check text-warning',
			Written: 'fa-check hilite-blue',
			Completed: 'fa-check text-success',
			Executed: 'fa-check text-success',
			Warning: 'fa-exclamation-triangle text-warning',
			Error: 'fa-times text-danger'
		},
		// The verifyPrecidence object sets the precidence of status so that a command cannot be un-verified if messages are not received from the SPJS in the correct order.
		verifyPrecidence: [ 'New', 'Sent', 'Queued', 'Written', 'Completed', 'Executed', 'Warning', 'Error' ],
		// Used to create the msgShow object in each port's consoleLog object.
		// NOTE: Loaded by cson file.
		msgShowDefault: {
			default: true,
			Open: true,
			OpenFail: true,
			Close: true,
			Broadcast: true,
			WipedQueue: true,
			Queued: true,
			Write: true,
			Complete: true,
			CompleteFake: true,
			Error: true,
			FeedRateOverride: true,
			RawPortData: true,
			SpjsCommand: true,	// A command sent to the spjs that is placed in the respective port's log.
			Command: true,
			MdiCommand: true,
			LogBot: true // Messages that are create by the console log to provide the user with information on important log events.
		},
		appendMsg(port, { Msg, Id, IdPrefix, Type, Status, Comment, Related, Meta }) {
			// This method gets called when a message is received from the SPJS and ports on the SPJS.
			// If Id is provided, it will be used for the message's id.
			// If Id is omitted but IdPrefix is provided, a new id based on the IdPrefix, port number, and line number will be created.
			// If both Id and IdPrefix are omitted, a new id based on the port number and line number will be created.
			// NOTE: The Id argument will be ignored if the IdPrefix argument is provided.

			if (Msg === '')
				debug.log('The append message method got the Msg argument as an empty string.');

			else if (typeof Msg == 'undefined')
				return debug.error('Aborted the append message method because the Msg argument was omitted.');

			else if (typeof Msg == 'object')
				Msg = JSON.stringify(Msg, null, ' ').replace(/\}$/, ' \}');

			// Check that the Type argument is valid.
			if (typeof Type == 'undefined' || typeof this.style[Type] == 'undefined') {

				debug.error('The append message method received a bad Type argument. Using default.\n  Type:', Type);
				Type = 'default';

			}

			// Prevent any messages containing '<' or '>' because these can mess with the console log DOM structure.
			if (/[<>]/.test(Msg)) {

				if (Type === 'stdout' || Type === 'stderr')
					debug.log(`There are '<' and/or '>' character(s) in the Msg argument. These can mess with the DOM structure of the console log. Characters removed.\nMessage: ${Msg}\nNew Message: ${Msg.replace(/</g, '&#60;').replace(/>/g, '&#62;')}`);

				Msg = Msg.replace(/</g, '&#60;').replace(/>/g, '&#62;');

			}

			if (typeof port == 'undefined' || typeof this[port] == 'undefined')
				return debug.error('The port argument was not passed properly.');

			// Apply the default values here so that warning messages can be logged.
			IdPrefix = IdPrefix || '';
			Status = Status || 'New';
			Meta = Meta || [];
			Comment = Comment ? `[${Comment}]` : '';

			if (Related && typeof Related == 'string')
				Related = { Port: Related };

			// This should not be needed becuse if there is just a single related command, the id of the command in the spjs will be the same as that of the related command.
			else if (Related && Related.Id && typeof Related.Id == 'string')
				Related.Id = [ `${Related.Id}` ];

			// If this is a message generated by the log bot, add the deliminators to the log bot message.
			if (Type === 'LogBot') {

				const [ leftDelimiter, rightDelimiter ] = this.logBotLineDelimiter;

				Msg = `${leftDelimiter}${Msg}${rightDelimiter}`;

			}

			// If the logData object has elements, get the line number from the last message in the logData object.
			let logLength = this[port].logData.length;
			const Line = logLength ? this[port].logData[logLength - 1].Line + 1 : 0;

			// If the message is a command.
			if (Type === 'Command' || Type === 'MdiCommand') {

				debug.groupCollapsed(`Append: ${Msg}`);

				// Make the id.
				if (IdPrefix) {
					Id = `${IdPrefix}-${port.toLowerCase().replace(/com/i, 'p').replace(/fs-dev-fs-tty/i, '')}n${Line}`;

				} else {
					Id = Id || `${port.toLowerCase().replace(/com/i, 'p').replace(/fs-dev-fs-tty/i, '')}n${Line}`;
				}

				if (this.commentCmdId) {
					Comment = Comment ? `${Comment} [${Id}]` : `[${Id}]`;
				}

				// Turn the Meta argument into an array.
				Meta = (typeof Meta == 'string') ? Meta.split(' ') : Meta;

				// Add the command data to this port's logData object.
				logLength = this[port].logData.push({ Msg, Id, Line, Type, Status, Comment, Related, Meta, Time: Date.now() });

				this[port].cmdMap.push(logLength - 1);

				debug.log(`Pushed onto cmdMap: ${this[port].cmdMap}`);
				debug.table(this[port].logData);

				// If the command is not already verified, add it to the verifyMap array.
				if (this.verifyPrecidence.indexOf(Status) < this.verifyPrecidence.indexOf('Completed')) {

					this[port].verifyMap.push(logLength - 1);

					debug.log(`Pushed onto verifyMap: ${this[port].verifyMap}`);

				}

				debug.groupEnd();

			// If the message is not a command, append the message data to this port's logData object.
			} else {

				logLength = this[port].logData.push({ Msg, Type, Line });

			}

			// JQuery reference to the console log panel.
			const logPanel = this[port].logPanelDOM;

			const logItem = this[port].logData[logLength - 1];

			// Append the message or command onto the end of the respective port's log.
			const msgHTML = this.buildMsgHTML(port, logItem);

			// Add the message to the bottom the the console log.
			logPanel.append(msgHTML);

			const a = logPanel.scrollTop() + Number(logPanel.css('height').match(/[0-9]+/)[0]);
			const b = logPanel.prop('scrollHeight') + 17.5;
			const atBottom = b - a <= this.autoScrollThreshold ? true : false;

			// Scroll to bottom of console log.
			atBottom && logPanel.scrollTop(logPanel.prop('scrollHeight'));

			// If the console log is longer than the limit, reduce the length of the log.
			if (this[port].logData.length > this.maxLineLimit) {

				this.truncateLog(port);

			}

			// Return the data that was just appended to the log.
			if (Type === 'Command' || Type === 'MdiCommand') {

				return {
					cmdMsg: logItem.Msg,
					cmdId: logItem.Id,
					cmdLine: logItem.Line,
					cmdType: logItem.Type,
					cmdStatus: logItem.Status,
					cmdComment: logItem.Comment,
					cmdRelated: logItem.Related,
					cmdTime: logItem.Time
				};

			}

			return true;

		},
		buildMsgHTML(port, { Msg, Id, IdPrefix, Line, Type, Status, Comment, Related, Meta }) {

			if (typeof this[port].msgShow[Type] === 'undefined') console.error(`Message type '${Type}' is undefined.`);

			// If the style object says that this message should not be shown, abort this method.
			if (!this[port].msgShow[Type]) return false;

			// JQuery reference to the console log panel.
			const logPanel = this[port].logPanelDOM;

			const prefixZeros = (Line.toString().length > this.minLineNumberDigits) ? 0 : this.minLineNumberDigits - Line.toString().length;
			const domLineNumber = '0'.repeat(prefixZeros) + Line;

			const domTag = (this.style[Type].includes('samp')) ? 'samp' : 'code';
			const domClass = ((port === 'SPJS') ? (this.style.lineWrap ? '' : 'text-nowrap ') : (this.style.lineWrap ? 'text-prewrap ' : 'text-pre ')) + this.style[Type].replace('samp ', '');
			const domMsg = Msg.replace(/\n/g, '').replace(/\r/g, '').replace(/\\"/g, '\"');

			// Build DOM element for the line number and left margin.
			let msgHTML = `<span class="text-muted" style="font-size: 8px; margin-right: ${(Type === 'Command' || Type === 'MdiCommand') ? '3px' : '19px'}; margin-left: 0px;">${domLineNumber}</span>`;

			// If this is a command, build DOM elements for command.
			if (Type === 'Command' || Type === 'MdiCommand') {

				// debug.log(`Port: ${port}\nMsg: ${Msg}\nType: ${Type}\nId: ${Id}\nStatus: ${Status}\nMeta: ${Meta}\nComment: ${Comment}\n${ Related ? (Related.Port ? `\nRelated Port: ${Related.Port}` : '') + (Related.Id ? `\nRelated Id: ${CSON.stringify(Related.Id)}` : '') : '' }`);

				const domCommentTag = (this.style.CmdComment.includes('samp')) ? 'samp' : 'code';
				const domCommentClass = ((this.style.lineWrap) ? 'text-pre ' : 'text-prewrap ') + this.style.CmdComment.replace('samp ', '');
				const domComment = Comment;

				msgHTML += `<span class="fa fa-check fa-fw verify-mark ${Id} ${this.verifyStyle[Status]}" style="font-size: 10px; margin-right: 3px;"></span>`;
				msgHTML += `<${domTag} class="cmd ${domClass}">${domMsg}</${domTag}>`;
				msgHTML += `<${domCommentTag} class="cmd-comment ${Id} ${domCommentClass}" style="margin-left: 6px;">${domComment}</${domCommentTag}><br />`;

			// If this is a message and not a command, build DOM elements for message.
			} else {
				msgHTML += `<${domTag} class="${domClass}">${domMsg}</${domTag}><br />`;

			}

			return msgHTML;

		},
		truncateLog(port) {

			// Have to re-assign index values in the cmdMap and verifyMap objects to point to new locations of items in the logData object and remove pointers to items that have been truncated.
			// Re-build the port's log using this.buildLog(port).

			if (typeof port == 'undefined' || typeof this[port] == 'undefined')  // If the port argument is not valid
				debug.error('The port argument is invalid.');

			const { maxLineLimit, minLineLimit } = this;
			const { logData, cmdMap, verifyMap } = this[port];
			const logLength = logData.length;

			if (logLength <= maxLineLimit)  // If the port is not exceeding the maximum length
				return false;

			debug.log(`Truncating the '${port}' log.`);

			const deleteCount = logLength - minLineLimit;
			const removedData = this[port].logData.splice(0, deleteCount);  // Truncate the log to the minLineLimit.

			let newCmdMap = [];
			let newVerifyMap = [];

			// Build the new cmdMap array.
			for (let i = 0; i < cmdMap.length; i++) {

				if (cmdMap[i] < deleteCount)  // If the element points to data that was truncated, do nothing with the element.
					continue;

				newCmdMap.push(cmdMap[i] - deleteCount);

			}

			// Build the new verifyMap array.
			for (let i = 0; i < verifyMap.length; i++) {

				if (verifyMap[i] < deleteCount)  // If the element points to data that was truncated, do nothing with the element.
					continue;

				newVerifyMap.push(verifyMap[i] - deleteCount);

			}

			this[port].cmdMap = newCmdMap;
			this[port].verifyMap = newVerifyMap;

			this.rebuildLog(port);

			return true;

		},
		rebuildLog(port) {

			debug.log(`Build the '${port}' log.`);

			const { logData, logPanelDOM } = this[port];

			let panelHTML = '';

			for (let i = 0; i < logData.length; i++)
				panelHTML += this.buildMsgHTML(port, logData[i]);

			logPanelDOM.html(panelHTML);

			return true;

		},
		makeRegExpSafe(str) {

			debug.log(`String: ${str}`);

			let safeString = '';

			for (let i = 0; i < str.length; i++) {

				if (/\w| /.test(str[i]))  // If the character is alphanumeric
					safeString += str[i];

				else  // If the character is not alphanumeric
					safeString += `\\${str[i]}`;

			}

			debug.log(`safeString: ${safeString}`);

			return safeString;

		},
		checkMatchItem(port, { Msg, PartMsg, Length, Id, Line, Type, Meta, MinAge, MaxAge, StatusCondition, LogItem, LogIndex }) {  // The checkMatchItem method checks for a match between an item in the log and given search criteria.

			debug.log('LogItem: %O', LogItem);

			if (typeof Msg != 'undefined' && LogItem.Msg !== Msg)
				return false;

			if (PartMsg instanceof RegExp) {

				if (PartMsg && !PartMsg.test(LogItem.Msg))
					return false;

				let logRefMsg = this.makeRegExpSafe(LogItem.Msg);

				if (PartMsg && !PartMsg.test(logRefMsg))
					return false;

			} else if (PartMsg && !LogItem.Msg.includes(PartMsg)) {

				return false;

			}

			if (typeof Length != 'undefined' && LogItem.Msg.length !== Length) return false;
			if (typeof Id != 'undefined' && LogItem.Id !== Id) return false;
			if (typeof Line != 'undefined' && LogItem.Line !== Line) return false;
			if (typeof Type != 'undefined' && LogItem.Type !== Type) return false;
			if (typeof StatusCondition != 'undefined' && LogItem.Status !== StatusCondition) return false;

			const unixNow = Date.now();
			const { findStaleCommands } = this;

			if (typeof MinAge != 'undefined' && LogItem.Time - unixNow < MinAge) return false;

			if (MaxAge && unixNow - LogItem.Time > MaxAge) {

				debug.log('Found old command.');

				// If the command is stale, flag it in the log.
				if (findStaleCommands && unixNow - LogItem.Time > this.staleCmdLimit && this.verifyPrecidence.indexOf(LogItem.Status) < this.verifyPrecidence.indexOf('Completed')) {

					debug.log('Found stale command.');

					this.updateCmd(port, { Index: LogIndex, Status: 'Warning', Comment: 'Stale', UpdateRelated: true });

				}

				return false;

			}

			// If the command is stale, flag it in the log and return as non-match.
			if (findStaleCommands && unixNow - LogItem.Time > this.staleCmdLimit && this.verifyPrecidence.indexOf(LogItem.Status) < this.verifyPrecidence.indexOf('Completed')) {

				debug.log('Found stale command.');

				this.updateCmd(port, { Index: LogIndex, Status: 'Warning', Comment: 'Stale', UpdateRelated: true });

				return false;

			}

			// Only counts a match as: all elements of Meta array are in the LogItem.Meta array.
			if (typeof Meta != 'undefined') {

				for (let x = 0; x < Meta.length; x++) {

					if (!LogItem.Meta.includes(Meta[x])) return false;

				}

			}

			return true;

		},
		findItem(port, { Msg, PartMsg, Length, Id, Line, Type, Meta, MinAge, MaxAge, StatusCondition, Index, IndexMap, SearchFrom = 0, SearchBackwards = false }) {
			// Return logData item of matched command within the specified search space.
			// Defaults to searching entire logData object, use IndexMap to narrow that search.
			// Arg. IndexMap [array] (optional) - Array of indexes to search for in the logData object (eg. [1, 15, 27, 69]).
			// Arg. StartFrom [number/string] (optional) - Defaults to zero (eg. 10, 'Last').
			// Arg. MaxAge [number] (optional) - Specifies the max age of a command for a match.

			if (typeof IndexMap == 'undefined' && typeof Index == 'undefined')  // If the IndexMap argumet is invalid
				debug.error('IndexMap is undefined.');

			let matchFound = false;
			let matchIndex = Index;

			const { logData } = this[port];
			const dataRef = typeof Msg != 'undefined' ? 'Msg' : (typeof PartMsg != 'undefined' ? 'PartMsg' : (typeof Length != 'undefined' ? 'Length' : (typeof Id != 'undefined' ? 'Id' : (typeof Line != 'undefined' ? 'Line' : 'Type'))));
			const data = arguments[1][dataRef];

			debug.groupCollapsed(`Find - ${dataRef}: ${data}`);

			let refMsg;

			// If the PartMsg argument is already a RegExp.
			if (PartMsg && PartMsg instanceof RegExp) {

				debug.log('PartMsg is a regExp.');
				refMsg = PartMsg;

			// If the PartMsg argument is a string.
			} else if (PartMsg) {

				// Use a RegExp to match data to command in the log.
				// Replace the square brackets with text because the square brackets mess with the RegExp and match method.
				// Note that any '\' character in the buffer is a text item but in the RegExp it becomes a modifier.
				// refMsg = new RegExp(this.makeRegExpSafe(PartMsg), 'i');
				debug.log(`Got PartMsg as a string. refMsg: ${refMsg}`);

			}

			// Make sure that the Meta argument is an array.
			if (typeof Meta != 'undefined' && !Array.isArray(Meta)) {

				Meta = [].push(Meta);

			}

			// If the Index argument was given.
			if (typeof Index != 'undefined') {

				debug.log('Index argument was given so not searching through the log for a match. Skiping to returning object data.');

				matchFound = true;

			// If the Index argument was omitted, search the port's console log for a match.
			} else if (!SearchBackwards) {

				debug.log('Searching forwards through the log for a match (ie. old to recent).');

				let init = 0;

				// Iterate through the IndexMap and figure out at what element of IndexMap should be used to strar searching for a match from.
				for (let i = 0; i < IndexMap.Length; i++) {

					if (IndexMap[i] >= SearchFrom) {

						init = i;
						break;

					}

				}

				// Search forwards through the console log for a match (ie. old -> new).
				for (let i = init; i < IndexMap.length; i++) {

					const logIndex = IndexMap[i];
					const LogItem = logData[logIndex];

					debug.log(`i: ${i}\nlogIndex: ${logIndex}\nIndexMap Length: ${IndexMap.length}\nLogItem: %O`, LogItem);

					// Check to see if found a match.
					if (this.checkMatchItem(port, { Msg, PartMsg: refMsg, Length, Id, Line, Type, Meta, MinAge, MaxAge, StatusCondition, LogItem, LogIndex: logIndex })) {

						debug.log('  ...got a match.');

						matchFound = true;
						matchIndex = logIndex;

						break;

					}

				}

			// Search backwards through the log for a match (ie. recent to old).
			} else {

				debug.log('Searching backwards through the log for a match (ie. recent to old).');

				let init = IndexMap.length - 1;
				const refIndex = SearchFrom;

				// Iterate through log items to set the initial index.
				for (let i = IndexMap.length - 1; i >= 0; i--) {

					if (IndexMap[i] <= refIndex) {

						init = i;

						break;

					}

				}

				// Search backwards through the console log for a match (ie. new -> old).
				for (let i = init; i >= 0; i--) {

					const logIndex = IndexMap[i];
					const LogItem = logData[logIndex];

					debug.log(`i: ${i}\nlogIndex: ${logIndex}\nIndexMap Length: ${IndexMap.length}\nLogItem: %O`, LogItem);

					// Check to see if found a match.
					if (this.checkMatchItem(port, { Msg, PartMsg: refMsg, Length, Id, Line, Type, Meta, MinAge, MaxAge, LogItem, LogIndex: logIndex })) {

						debug.log('  ...got a match.');

						matchFound = true;
						matchIndex = logIndex;

						break;

					}
				}

			}

			// If a match was found in this port's console log, return the object data.
			if (matchFound) {

				const matchItem = this[port].logData[matchIndex];

				debug.log('Found match in log:', matchItem);
				debug.groupEnd();

				return {
					matchFound,
					matchIndex,
					matchMsg: matchItem.Msg,
					matchId: matchItem.Id,
					matchLine: matchItem.Line,
					matchType: matchItem.Type,
					matchStatus: matchItem.Status,
					matchComment: matchItem.Comment,
					matchRelated: matchItem.Related,
					matchMeta: matchItem.Meta,
					matchTime: matchItem.Time,
					matchIndexMap: IndexMap
				};

			}

			debug.log(`No match found in '${port}' log for ${Msg !== undefined ? 'Msg' : (PartMsg !== undefined ? 'PartMsg' : (Length !== undefined ? 'Length' : (Id !== undefined ? 'Id' : (Line !== undefined ? 'Line' : 'Type'))))}: ${data}`);
			debug.groupEnd();

			return { matchFound };

		},
		updateCmd(port, { Msg, PartMsg, Length, Id, Line, Type, Meta, MinAge, MaxAge, StatusCondition, Index, IndexMap, SearchFrom, SearchBackwards, Status, Comment, PrevComment = 'left', UpdateRelated, recursionDepth = 0 }) {
			// This method updates the status of commands in the SPJS console log.
			// Matches to command data can be partial and are not cose sensitive but matches to command id's have to be exact.
			// Arg. port - Specifies the console log (eg. "SPJS" or "COM7").
			// Arg. status - Specifies the new status to apply to a matched command (eg. "Written" or "Executed").
			// Arg. SearchFrom [int] - Specify the index of IndexMap from which to start searching for a match. If Status is 'Warning' or 'Error', default is -1. Otherwise default is 0.
			// Arg. PrevComment [string] - Specify that the previous comment should be to the left or right of the new comment or it should be cleared (eg. 'left' or 'right' or 'clear').
			//   Default: 'left'.
			// Arg. UpdateRelated [boolean] - Specify wether the related message(s) in another log should also be updated.
			//   Default: If port is SPJS - true. Otherwise - false.

			if (typeof this[port] == 'undefined') {  // If the port argument is invalid

				debug.error(`The consoleLog.${port} object is undefined.`);
				return;

			}

			if (!Status && typeof Comment == 'undefined') {  // If the Comment argument is invalid

				debug.error('No Update Requested. Aborting update');
				return;

			}

			if (recursionDepth && recursionDepth >= this[port].logData.length) {  // If the recursion depth limit has been exceeded

				debug.error('Infinite loop detected.');
				return;

			}

			debug.groupCollapsed(`${port}${Comment ? ` - Comment: '${Comment}'` : ''}${Status ? ` - Status: ${Status}` : ''} - ${Msg !== undefined ? `Msg: ${Msg}` : (PartMsg !== undefined ? `PartMsg: ${PartMsg}` : (Length !== undefined ? `Length: ${Length}` : (Id !== undefined ? `Id: ${Id}` : (Line !== undefined ? `Line: ${Line}` : (Index !== undefined ? `Index: ${Index}` : `Type: ${Type}`)))))}`);
			// debug.groupCollapsed(`Update ${ Status ? 'status' : 'comment' }: ${ Msg || PartMsg || Id || Line || Type }`);
			debug.log(CSON.stringify(arguments));

			const { cmdMap, verifyMap, logData } = this[port];

			// Use verifyMap if doing a status update other than warning or error.
			// If performing a status update other than 'warning' or 'error'
			if (typeof IndexMap == 'undefined' && Status && Status !== 'Warning' && Status !== 'Error')
				IndexMap = verifyMap;

			else if (typeof IndexMap == 'undefined')
				IndexMap = cmdMap;

			if (typeof SearchFrom == 'undefined' && (Status === 'Warning' || Status === 'Error')) {

				SearchFrom = IndexMap[IndexMap.length - 1];

				if (typeof SearchBackwards == 'undefined')
					SearchBackwards = true;

			} else if (typeof SearchFrom == 'undefined') {

				SearchFrom = 0;

			}

			if (typeof SearchBackwards == 'undefined')
				SearchBackwards = false;

			if (typeof UpdateRelated == 'undefined' && port === 'SPJS')
				UpdateRelated = true;

			else if (typeof UpdateRelated == 'undefined')
				UpdateRelated = false;

			// Check if command is in this port's verify buffer.
			// const matchItem = this.findItem(port, { Msg, PartMsg, Id, Index, IndexMap: this[port].verifyMap });
			let { matchFound, matchIndex, matchMsg, matchId, matchLine, matchType, matchStatus, matchMeta, matchComment, matchRelated, matchTime, matchIndexMap } = this.findItem(port, { Msg, PartMsg, Length, Id, Line, Type, Meta, MinAge, MaxAge, StatusCondition, Index, IndexMap, SearchFrom, SearchBackwards });

			debug.log('matchFound:', matchFound, '\nmatchIndex:', matchIndex, '\nmatchMsg:', matchMsg, '\nmatchId:', matchId, '\nmatchLine:', matchLine, '\nmatchType:', matchType, '\nmatchStatus:', matchStatus, '\nmatchComment:', matchComment, '\nmatchRelated:', matchRelated, '\nmatchMeta:', matchMeta, '\nmatchTime:', matchTime);

			if (typeof matchIndex == 'undefined') {

				debug.log('No Match Found. Aborting update.');
				debug.groupEnd();

				return { matchFound };

			}

			// If the Status argument was passed and this is not a redundant update, update the status of the command in the log.
			if (Status && this.verifyPrecidence.indexOf(matchStatus) < this.verifyPrecidence.indexOf(Status)) {

				// let removeItem = (Status === 'Error' || Status === 'Warning' || Status === 'Executed' || (Status === 'Completed' && !matchMeta.includes('NumberedGCode'))) ? true : false;
				const removeItem = (Status === 'Error' || Status === 'Warning' || Status === 'Executed' || Status === 'Completed');

				const bufferLength = this[port].verifyMap.length;

				debug.log('Status Update.');
				debug.log(`Remove item: ${removeItem}`);
				// debug.log('Match item:', matchItem);
				debug.log('cmdMap:', this[port].cmdMap, '\nverifyMap:', this[port].verifyMap);

				// Update the style of the respective command's check-mark DOM element (ie. remove previous style and add new style).
				$(`#connection-widget .console-log-panel .log-${port} span.verify-mark.${matchId}`).removeClass(this.verifyStyle[matchStatus]).addClass(this.verifyStyle[Status]);
				// debug.log(`#connection-widget .console-log-panel .log-${port} span.verify-mark.${matchId}`);

				logData[matchIndex].Status = Status;

				debug.log('Updated status.');
				debug.log(`  Prev status: ${matchStatus}\n  New status: ${logData[matchIndex].Status}`);

				// If removeItem is true, remove the matched command from the verifyMap array.
				if (removeItem && this[port].verifyMap.includes(matchIndex)) {

					if (this.commentTimeToVerify && (!matchMeta.includes('portSendJson') || (matchMeta.includes('portSendJson') && (port === 'SPJS' || matchMeta.includes('1of1'))))) {

						const deltaTime = Date.now() - matchTime;

						debug.log(`Time to ${Status}: ${deltaTime}ms`);

						const timeStr = `${deltaTime}`;
						let timeComment = 'ms';

						// If the number is larger than 9999, put a comma between sets of digits (eg. '43,234ms').
						if (deltaTime > 9999) {

							for (let i = 0; i < timeStr.length; i++) {

								if (i === 3 || i === 9 || i === 12)
									timeComment = `,${timeComment}`;

								timeComment = `${timeStr[(timeStr.length - i) - 1]}${timeComment}`;

							}

						} else {
							timeComment = `${deltaTime}ms`;

						}

						// let timeComment = `${deltaTime}ms`;

						this.updateCmd(port, { Index: matchIndex, Comment: timeComment, PrevComment: 'right', UpdateRelated: false });

					}

					// Remove the item from the verifyMap object.
					this[port].verifyMap.splice(this[port].verifyMap.indexOf(matchIndex), 1);

					debug.log('  cmdMap:', this[port].cmdMap, '\n  verifyMap:', this[port].verifyMap);

					debug.table(this[port].logData);

					if (bufferLength && this[port].verifyMap.length + 1 === bufferLength)  // If the item was successfully removed from the verifyMap
						debug.log('Item was removed from the verifyMap.');

					else  // If the item was not successfully removed from the verifyMap
						debug.error('Item was not successfully removed from the verifyMap.');

				} else if (removeItem) {

					debug.log('Item was already removed from the verifyMap.');

				}

			} else if (this.enableRecursiveUpdate && Status && this.verifyPrecidence.indexOf(matchStatus) >= this.verifyPrecidence.indexOf(Status) && (!Comment || (Comment !== 'Stale'))) {  // If this a redundant status update, look for another match in the log incase this is the wrong command in the log.

				debug.log('Redundant Status Update.');

				if ((Status === 'Warning' || Status === 'Error') && SearchFrom > 0 && SearchFrom !== IndexMap[0]) {  // Search backwards (ie. recent to oldest)

					recursionDepth += 1;
					const nextSearchIndex = SearchFrom - 1;

					debug.groupEnd();
					debug.log(`Redundant Status Update. Trying to find an older match in the log. SearchFrom: ${nextSearchIndex}`);

					return this.updateCmd(port, { Msg, PartMsg, Length, Id, Line, Type, Index, IndexMap, SearchFrom: nextSearchIndex, SearchBackwards: true, Status, Comment, PrevComment, UpdateRelated, recursionDepth });

				} else if (Status !== 'Warning' && Status !== 'Error' && SearchFrom < logData.length - 1 && SearchFrom !== IndexMap[IndexMap.length - 1]) {  // Search forwards (ie. oldest to recent)

					recursionDepth += 1;
					const nextSearchIndex = SearchFrom + 1;

					debug.groupEnd();
					debug.log(`Redundant Status Update. Trying to find a newer match in the log. SearchFrom: ${nextSearchIndex}`);

					return this.updateCmd(port, { Msg, PartMsg, Length, Id, Line, Type, Index, IndexMap, SearchFrom: nextSearchIndex, Status, Comment, PrevComment, UpdateRelated, recursionDepth });

				}

			}

			// If a Comment argument was passed and this is not a redundant update, add the comment to the respective port in the log.
			if (typeof Comment != 'undefined' && !matchComment.includes(`[${Comment}]`)) {

				debug.log('Comment update.');

				// Get the new value of the comment in case the comment was updated by the status update (ie. time to execute/error was added).
				matchComment = logData[matchIndex].Comment;

				let newComment = '';

				if (PrevComment === 'left')        // Add the new comment to the right of any previous comments
					newComment = matchComment ? `${matchComment} [${Comment}]` : (Comment ? `[${Comment}]` : '');

				else if (PrevComment === 'right')  // Add the new comment to the left of any previous comments
					newComment = matchComment ? `[${Comment}] ${matchComment}` : (Comment ? `[${Comment}]` : '');

				else if (PrevComment === 'clear')  // Replace any previous comments with the new comment
					newComment = Comment ? `[${Comment}]` : '';

				// Update the style of the respective command's comment DOM element (ie. remove previous style and add new style).
				$(`#connection-widget .console-log-panel .log-${port} ${this.style.CmdComment.includes('samp') ? 'samp' : 'code'}.cmd-comment.${matchId}`).text(`${newComment}`);
				// debug.log(`#connection-widget.console-log-panel .log-${port} ${this.style.CmdComment.includes('samp') ? 'samp' : 'code'}.cmd-comment.${matchId}`);

				logData[matchIndex].Comment = newComment;

				debug.log(`New Comment: ${newComment}`);

			// If this is a redundant comment update, skip the comment update.
			} else if (Comment && matchComment.includes(`[${Comment}]`)) {

				debug.log('Redundant Comment Update.');

			}

			if (matchRelated && !matchRelated.Port)  // If matchRelated does not have associated port
				debug.error('matchRelated does not have a port.');

			if (UpdateRelated && matchRelated && matchRelated.Port && this[matchRelated.Port]) {  // If the command has a related command in a port's log

				debug.log(`Found related port:\n${CSON.stringify(matchRelated)}`);

				if (matchRelated.Id) {  // If there is a match Id

					if (!Array.isArray(matchRelated.Id))
						debug.error('matchRelated.Id is not an array.');

					for (let i = 0; i < matchRelated.Id.length; i++)  // Update each message in the port's console log using Ids in this list of related Ids
						this.updateCmd(matchRelated.Port, { Id: matchRelated.Id[i], Status, Comment, PrevComment, UpdateRelated: false });

				} else {

					this.updateCmd(matchRelated.Port, { Id: matchId, Status, Comment, PrevComment, UpdateRelated: false });

				}

			} else if (UpdateRelated && port !== 'SPJS') {

				debug.log('Finding related message in the SPJS log.');
				this.updateCmd('SPJS', { Id: matchId, Status, Comment, PrevComment, UpdateRelated: false });

			}

			const matchItem = logData[matchIndex];
			debug.groupEnd();

			return {
				matchFound,
				matchIndex,
				matchMsg: matchItem.Msg,
				matchId: matchItem.Id,
				matchLine: matchItem.Line,
				matchType: matchItem.Type,
				matchStatus: matchItem.Status,
				matchMeta: matchItem.Meta,
				matchComment: matchItem.Comment,
				matchRelated: matchItem.Related,
				matchTime: matchItem.Time,
				matchIndexMap
			};

		}

	},

	initBody() {

		debug.group(`${this.name}.initBody()`);

		subscribe('/main/all-widgets-loaded', this, this.wsConnect.bind(this));   // Only connect to SPJS once all widgets have loaded so that we dont publish any important signals before other widgets have a chance to subscribe to them.
		subscribe('/main/window-resize', this, this.resizeWidgetDom.bind(this));  // When the window resizes, look at updating the size of DOM elements.
		subscribe('/main/widget-visible', this, this.visibleWidget.bind(this));   // If this widget is made visible, update the size of DOM elements.

		subscribe(`/${this.id}/spjs-send`, this, this.newspjsSend.bind(this));    // Send a given message to the SPJS and add it to the console log so that it can be displayed as incomplete/complete.
		subscribe(`/${this.id}/port-send`, this, this.newportSend.bind(this));    // Send message directly to SPJS as 'send [port] [cmd]' and add it to the respective port's log.
		subscribe(`/${this.id}/port-sendnobuf`, this, this.newportSendNoBuf.bind(this));    // Send message directly to SPJS as 'sendnobuf [port] [cmd]' and add it to the respective port's log.
		subscribe(`/${this.id}/port-sendjson`, this, this.newportSendJson.bind(this));      // Send message directly to SPJS as 'sendjson { P: [port], Data: [{ D: [cmd], Id: [id] }] }' and add it to the respective port's log.
		subscribe(`${this.id}/port-sendbuffered`, this, this.portSendBuffered.bind(this));
		subscribe(`/${this.id}/port-feedstop`, this, this.portFeedstop.bind(this));         // Sends message to the given port to stop all motion on that device.

		subscribe('gcode-buffer/control', this, this.gcodeBufferControl.bind(this));  // Control information about the buffering of gcode to the SPJS.

		Mousetrap.bind('ctrl+pageup', this.keyboardShortcuts.bind(this, 'ctrl+pageup'));      // Show device log to the left
		Mousetrap.bind('ctrl+pagedown', this.keyboardShortcuts.bind(this, 'ctrl+pagedown'));  // Show device log to the right

		this.initSettings();      // Load settings from cson files
		this.initClickEvents();   // Initialize click events on buttons
		this.initConsoleInput();  // Initialize events on manual data inputs

		publish('/main/widget-loaded', this.id);  // Send signal when widget is loaded to tell main process

		return true;

	},
	initSettings() {

		const that = this;

		debug.log('Loading Settings from CSON files.');

		CSON.parseCSONFile(`${this.id}/SPJS.cson`, (err, data) => {  // Synchronously load SPJS and console log settings

			if (err) {  // If there was an error reading the file

				debug.warn(err);
				return false;

			}

			debug.log('Data:', CSON.stringify(data));

			// Merge the objects in the cson file with the ones here.
			gui.mergeDeep(that.SPJS, data);

		});

		CSON.parseCSONFile(`${this.id}/Console_Log.cson`, (err, data) => {  // Synchronously load SPJS and console log settings

			if (err) {  // If there was an error reading the file

				debug.warn(err);
				return false;

			}

			debug.log('Data:', CSON.stringify(data));

			// Merge the objects in the cson file with the ones here.
			gui.mergeDeep(that.consoleLog, data);

		});

		CSON.parseCSONFile(`${this.id}/Device_Meta.cson`, (err, data) => {  // Synchronously load device meta settings

			if (err) {  // If there was an error reading the file

				debug.warn(err);
				return false;

			}

			debug.log('Data:', CSON.stringify(data));

			const { DefaultMetaIndex, DeviceMeta } = data;

			// Merge the objects in the cson file with the ones here.
			if (typeof DefaultMetaIndex != 'undefined')
				that.defaultMetaIndex = DefaultMetaIndex;

			if (typeof DeviceMeta != 'undefined' && DeviceMeta.length)
				that.deviceMeta = [ ...DeviceMeta ];

		});

		CSON.parseCSONFile(`${this.id}/Init_Scripts.cson`, (err, data) => {  // Synchronously load init and connect scripts

			if (err) {  // If there was an error reading the file

				debug.warn(err);
				return false;

			}

			const { InitScripts, ConnectScripts } = data;

			debug.log('Data:', CSON.stringify(data));

			// Merge the objects in the cson file with the ones here.
			if (typeof InitScripts != 'undefined')
				that.initScripts = InitScripts;

			if (typeof ConnectScripts != 'undefined')
				that.connectScripts = ConnectScripts;

		});

		if (inDebugMode) {  // If running on a development device

			this.SPJS.requestListDelay = null;    // Disable automatic list requests
			this.consoleLog.commentCmdId = true;  // Comment the id of commands on the console log

		}

		debug.groupCollapsed('CSON Format');
		debug.log(`SPJS:${CSON.stringify(this.SPJS)}`);
		debug.log(`consoleLog:${CSON.stringify(this.consoleLog)}`);
		debug.log(`deviceMeta:${CSON.stringify(this.deviceMeta)}`);
		debug.log(`defaultMetaIndex:${CSON.stringify(this.defaultMetaIndex)}`);
		debug.log(`initScripts:${CSON.stringify(this.initScripts)}`);
		debug.log(`connectScripts:${CSON.stringify(this.connectScripts)}`);
		debug.groupEnd();

		debug.groupCollapsed('JSON Format');
		debug.log(`SPJS:${JSON.stringify(this.SPJS)}`);
		debug.log(`consoleLog:${JSON.stringify(this.consoleLog)}`);
		debug.log(`deviceMeta:${JSON.stringify(this.deviceMeta)}`);
		debug.log(`defaultMetaIndex:${JSON.stringify(this.defaultMetaIndex)}`);
		debug.log(`initScripts:${JSON.stringify(this.initScripts)}`);
		debug.log(`connectScripts:${JSON.stringify(this.connectScripts)}`);
		debug.groupEnd();

		debug.log('Loading Status Codes from cson file.');

		CSON.parseCSONFile(`${this.id}/TinyG_Status_Codes.cson`, (err, result) => {  // Synchronously load tinyg status codes

			if (err) {

				debug.warn(err);
				return false;

			}

			if (typeof result != 'undefined')
				that.tinygStatusMeta = result;

		});

	},
	initClickEvents() {

		const that = this;

		// Console log tab events.
		$(`#${this.id} .console-log-panel .nav-tabs`).on('click', 'span', function (evt) {
			// debug.log("evt:", evt);
			// debug.log("View " + $(this).attr("evt-data") + " log.");
			that.consoleLogChangeView($(this).attr('evt-data'));
		});

		// Serial port list header button events.
		$(`#${this.id} .splist-panel .panel-heading .btn-group`).on('click', 'span.btn', function (evt) {
			// debug.log("evt:", evt, "\nthis:", this);
			// debug.log("  evt-signal: " + $(evt.currentTarget).attr("evt-signal"));
			// debug.log("  evt-data: " + $(evt.currentTarget).attr("evt-data"));
			let evtSignal = $(this).attr('evt-signal');
			let evtData = $(this).attr('evt-data');

			if (evtSignal === 'hide-body') {

				$(`#connection-widget .${evtData} .panel-body`).addClass('hidden');
				$(this).find('span').removeClass('glyphicon-chevron-up').addClass('glyphicon-chevron-down');
				$(this).attr('evt-signal', 'show-body');

				that.resizeWidgetDom();

			} else if (evtSignal === 'show-body') {

				$(`#connection-widget .${evtData} .panel-body`).removeClass('hidden');
				$(this).find('span').removeClass('glyphicon-chevron-down').addClass('glyphicon-chevron-up');
				$(this).attr('evt-signal', 'hide-body');

				that.resizeWidgetDom();

			} else if (evtData === 'list') {

				that.newspjsSend({ Msg: 'list', Type: 'Command' });

			} else if (evtData === 'restart') {

				that.newspjsSend({ Msg: 'restart', Type: 'Command' });

			} else if (evtSignal) {
				publish(evtSignal, evtData);

			}

		});

		// Click events for each port in the serial port list.
		$(`#${this.id} .splist-panel table.serial-port-list`).on('click', 'tr', function (evt) {

			const port = $(this).attr('evt-data');
			const portMeta = that.SPJS.portMeta;

			let Msg = '';

			const unsafePort = that.makePortUnSafe(port);

			if (that.consoleLog.openLogs.includes(port)) {
				debug.log(`Port ${unsafePort} selected.\n  ...closing port.`);

				// Prevent the port from autoconnecting again.
				that.deviceMeta[portMeta[port].metaIndex].autoConnectPort = false;

				Msg = `close ${unsafePort}`;

			} else {
				debug.log(`Port ${unsafePort} selected.\n  ...opening port.`);

				// Allow the port to autoconnecting again if it was dissabled by a manual port close.
				// that.deviceMeta[portMeta[port].metaIndex].autoConnectPort = false;

				Msg = `open ${unsafePort} ${portMeta[port].Baud} ${portMeta[port].Buffer}`;

			}

			that.newspjsSend({ Msg });

		});
	},
	initConsoleInput() {
		// SPJS and serial port inputs.
		// TODO: Recall past commands by pressing the arrow keys.
		let that = this;
		let consoleInputDom = `#${this.id} .console-log-panel .console-input input`;

		// backspace		8
		// tab				9
		// enter			13
		// shift			16
		// ctrl				17
		// alt				18
		// pause/break		19
		// caps lock		20
		// escape			27
		// page up			33
		// page down		34
		// end				35
		// home				36
		// left arrow		37
		// up arrow			38
		// right arrow		39
		// down arrow		40
		// insert			45
		// delete			46
		// [0-9]:			48-57
		// [a-z]:			65-90
		// window key [left,right]: 91,92
		// select key:		93
		// numpad [0-9]:	96-105
		// numpad period	110
		// f [1-12]:		112-123
		// num lock:		144
		// scroll lock:		145
		// semicolon:		186
		// equal sign:		187
		// comma:			188
		// dash:			189
		// period:			190
		// forward slash:	191
		// grave accent:	192
		// open bracket:	219
		// back slash:		220
		// close braket:	221
		// single quote:	222

		$(consoleInputDom).on('keydown', (evt) => {
			// debug.log("keyCode: " + evt.keyCode);
			// debug.log("key: " + evt.key);
			// TODO: Set cursor to end of text in the input field after recalling a previous command from the history list.
			let activeLog = that.consoleLog.activeLog;
			let activeConsoleLog = that.consoleLog[activeLog];
			let historyRecallIndex = activeConsoleLog.historyRecallIndex;

			let key = Number(evt.keyCode);
			let inputData = $(consoleInputDom).val();

			// If 'ctrl-pagedown' was pressed, change the visible console log.
			if (evt.ctrlKey && evt.key === 'PageDown') this.consoleLogChangeView('right');

			// If 'ctrl-pageup' was pressed, change the visible console log.
			if (evt.ctrlKey && evt.key === 'PageUp') this.consoleLogChangeView('left');

			// If the 'backspace' key was pressed.
			if (evt.keyCode == '8') {
				// debug.log("evt:", evt);
				activeConsoleLog.value = inputData;

			// If the 'enter' key was pressed.
			} else if (evt.keyCode == 13) {
				// debug.log("evt:", evt);
				// TODO: Write a more elegant solution.
				that.consoleLogParseInput();
				activeConsoleLog.value = '';
				historyRecallIndex = null;

			// If the 'up-arrow' was pressed.
			} else if (evt.keyCode == '38') {

				let history = activeConsoleLog.history;

				if (historyRecallIndex === null && history.length) {

					activeConsoleLog.historyRecallIndex = 0;
					$(consoleInputDom).val(activeConsoleLog.history[activeConsoleLog.historyRecallIndex]);

				} else if (historyRecallIndex < history.length - 1) {

					activeConsoleLog.historyRecallIndex += 1;
					$(consoleInputDom).val(activeConsoleLog.history[activeConsoleLog.historyRecallIndex]);

				}
				// activeConsoleLog.historyRecallIndex = (historyRecallIndex === null) ? 0:++historyRecallIndex;
				// debug.log("historyRecallIndex: " + activeConsoleLog.historyRecallIndex);

			// If the 'down-arrow' was pressed.
			} else if (evt.keyCode == '40') {

				if (historyRecallIndex === null) {
					// $(consoleInputDom).val(this.consoleLog[activeLog].value);

				} else if (historyRecallIndex === 0) {

					activeConsoleLog.historyRecallIndex = null;
					$(consoleInputDom).val(activeConsoleLog.value);

				} else {

					activeConsoleLog.historyRecallIndex -= 1;
					$(consoleInputDom).val(activeConsoleLog.history[activeConsoleLog.historyRecallIndex]);

				}
				// debug.log("historyRecallIndex: " + activeConsoleLog.historyRecallIndex);

			// If a character key was pressed.
			} else if (evt.key.length === 1) {

				// TODO: Fix issue with inserting text into middle of string in input field.
				inputData += evt.key;

			}

			if (evt.keyCode != '13' && evt.keyCode != '38' && evt.keyCode != '40') {

				activeConsoleLog.value = inputData;
				activeConsoleLog.historyRecallIndex = null;
				// debug.log(activeLog + ":" + gui.parseObject(that.consoleLog, 2));
				// debug.log(activeLog + " Log:" + gui.parseObject(activeConsoleLog, 2));

			}

		});

	},
	keyboardShortcuts(data) {

		// If this widget is not visible, do not apply any keyboard shortcuts and abort this method.
		// if (!this.widgetVisible) return false;

		if (data === 'ctrl+pageup')
			this.consoleLogChangeView('left');

		else if (data === 'ctrl+pagedown')
			this.consoleLogChangeView('right');

		return true;

	},
	// FIXME: If the console log was scrolled to the bottom when widget resized, scroll to bottom of log after resize.
	resizeWidgetDom() {

		// If widget is not visible, do not update the size of DOM elements.
		if (!this.widgetVisible) return false;

		const that = this;

		// TODO: Do the resize stuff like this: $(selector).attr(attribute,function(index,currentvalue))
		// index - Receives the index position of the element in the set.
		// currentvalue - Receives the current attribute value of the selected elements.
		// Put the .attr() function inside of a $.each() loop.

		$.each(this.widgetDom, (setIndex, setItem) => {
			// debug.log("setIndex:", setIndex, "\nsetItem:", setItem);
			let that1 = that;
			let containerElement = null;
			let containerHeight = null;
			let marginSpacing = 0;
			let panelSpacing = 0;

			$.each(setItem, (panelIndex, panelItem) => {
				// debug.log("  panelIndex:", panelIndex, "\n  panelItem:", panelItem);
				// If panelItem is the container element, skip it.
				if (!panelIndex) {
					containerElement = `#${that1.id}${panelItem}`;
					containerHeight = $(containerElement).height();
					// debug.log("    Container: " + containerElement + "\n    Height: " + containerHeight);
					return true;
				}

				let elementItem = containerElement + panelItem;
				marginSpacing += Number($(elementItem).css('margin-top').replace(/px/g, ''));

				// Last element in array, set it's height.
				if (panelIndex === setItem.length - 1) {

					marginSpacing += Number($(elementItem).css('margin-bottom').replace(/px/g, ''));

					let panelHeight = containerHeight - (marginSpacing + panelSpacing);

					$(elementItem).css({ 'height': `${panelHeight}px` });
					// debug.log("    panelHeight: " + panelHeight);

				// If this is not the last element in the array, read the element's height.
				} else {

					panelSpacing += Number($(elementItem).css('height').replace(/px/g, ''));

				}

			});
		});

		$('#connection-widget div.console-log-panel div.panel-body div').width($('#connection-widget div.console-log-panel div.panel-body').width() - 10);
		return true;

	},
	visibleWidget(wgtVisible, wgtHidden) {

		if (wgtVisible === this.id) {

			// debug.log(`${this.id} is now visible.`);
			this.widgetVisible = true;

			this.resizeWidgetDom();

		} else if (wgtHidden === this.id) {

			// debug.log(`${this.id} is now hidden.`);
			this.widgetVisible = false;

		}

	},

	wsConnect() {
		// This method creates a new WebSocket connection to the SPJS and is called by the '/main/all-widgets-loaded' subscribe line.

		// debug.log("Attempting to connect to the SPJS now.");
		// debug.log("Web Socket (before calling 'new WebSocket()'):" + gui.parseObject(this.SPJS.ws, 2, { keep: ["CONNECTING", "OPEN", "CLOSING", "CLOSED", "url", "readyState", "bufferedAmount"] }));
		const socketUrl = 'ws://localhost:8989/ws';
		// const socketUrl = 'ws://192.168.1.68:8888/ws';
		// const socketUrl = 'ws://192.168.1.68:8888/ws';

		this.SPJS.ws = new WebSocket(socketUrl);

		this.SPJS.ws.onopen = () => this.onSpjsOpen();
		this.SPJS.ws.onmessage = evt => this.onSpjsMessage(evt.data);
		this.SPJS.ws.onerror = error => this.onSpjsError(error);
		this.SPJS.ws.onclose = () => this.onSpjsClose();

	},
	launchSpjs() {

		debug.log('Launching a new SPJS.');

		const { platform, architecture, os } = hostMeta;
		const { launchGpioServerOnLinux } = this.SPJS;

		// If on a Raspberry Pi.
		if (platform === 'linux' && architecture === 'arm') {

			// Launch the SPJS in max garbage collection mode.
			this.SPJS.go = spawn('lxterminal --command "sudo json_server/linux_arm/serial-port-json-server -gc max -allowexec"', [], { shell: true });
			// this.SPJS.go = spawn(`lxterminal --command "sudo serial-port-json-server-1.92_linux_arm/serial-port-json-server -gc max -allowexec"`, [], { shell: true });

			if (launchGpioServerOnLinux) {

				// Launch the GPIO JSON server.
				this.SPJS.gpio = spawn('lxterminal --command "sudo json_server/linux_arm/gpio-json-server"', [], { shell: true });

				this.SPJS.gpio.stdout.on('data', (data) => {

					debug.log(`GPIO Server. stdout: ${data}`);

					let msg = `${data}`;
					let msgBuffer = msg.split('\n');

					for (let i = 0; i < msgBuffer.length; i++) {

						msgBuffer[i] && this.consoleLog.appendMsg('SPJS', { Msg: msgBuffer[i], Type: 'stdout' });

					}

				});

				this.SPJS.gpio.stderr.on('data', (data) => {

					debug.log(`GPIO Server. stderr: ${data}`);

					let msg = `${data}`;
					let msgBuffer = msg.split('\n');

					for (let i = 0; i < msgBuffer.length; i++) {

						msgBuffer[i] && this.consoleLog.appendMsg('SPJS', { Msg: msgBuffer[i], Type: 'stderr' });

					}

				});

				this.SPJS.gpio.on('close', (code) => {
					debug.log(`GPIO Server. Child precess exited with the code: ${code}`);

				});

			}

		// If the host is on a windows platform.
		} else if (os === 'Windows') {

			// Launch the SPJS in max garbage collection mode.
			this.SPJS.go = spawn('cd json_server/windows_x64 && serial-port-json-server.exe', [ '-gc max', '-allowexec' ], { shell: true });

		}
		// this.SPJS.go = spawn(`cd json_server && serial-port-json-server.exe`, ['-gc max'], { shell: true });
		// Launch the SPJS in verbose mode with max garbage collection.
		// this.SPJS.go = spawn(`cd json_server && serial-port-json-server.exe`, ['-gc max', '-v'], { shell: true });

		this.SPJS.go.stdout.on('data', (data) => {

			debug.log(`SPJS. stdout: ${data}`);

			let msg = `${data}`;
			let msgBuffer = msg.split('\n');

			for (let i = 0; i < msgBuffer.length; i++) {

				msgBuffer[i] && this.consoleLog.appendMsg('SPJS', { Msg: msgBuffer[i], Type: 'stdout' });

			}

		});

		this.SPJS.go.stderr.on('data', (data) => {

			debug.log(`SPJS. stderr: ${data}`);

			let msg = `${data}`;
			let msgBuffer = msg.split('\n');

			for (let i = 0; i < msgBuffer.length; i++) {

				msgBuffer[i] && this.consoleLog.appendMsg('SPJS', { Msg: msgBuffer[i], Type: 'stderr' });

			}

		});

		this.SPJS.go.on('close', (code) => {

			debug.log(`SPJS. Child precess exited with the code: ${code}`);

		});

	},
	onSpjsOpen() {

		// If the SPJS is already in an 'open' state, skip DOM updates.
		if (this.SPJS.wsState === 'open') return false;

		// debug.log("WebSocket -onOpen-" + gui.parseObject(this.SPJS.ws, 2, { keep: ["url"] }));
		debug.groupCollapsed(`WebSocket -onOpen-${gui.parseObject(this.SPJS.ws, 2, { keep: [ 'url' ] })}`);
		debug.log(`ws:${gui.parseObject(this.SPJS.ws, 2, { keep: [ 'CONNECTING', 'OPEN', 'CLOSING', 'CLOSED', 'url', 'readyState', 'bufferedAmount' ] })}`);

		this.SPJS.wsState = 'open';

		$(`#${this.id} .spjs-connection-warning`).addClass('hidden');
		$(`#${this.id} .serialport-connection-warning`).removeClass('hidden');

		publish('/statusbar-widget/hilite', 'SPJS', 'success');

		debug.log(`openPorts: ${gui.parseObject(this.SPJS.openPorts)}`);
		debug.log(`openLogs: ${gui.parseObject(this.consoleLog.openLogs)}`);

		this.resizeWidgetDom();

		debug.groupEnd();

	},
	onSpjsMessage(msg) {
		// This method receives all messages from the SPJS and sends each message to it's respective method.

		if (msg.match(/^\{/)) {
			let data = null;

			try {
				data = JSON.parse(msg);

				debug.info(data);

			} catch (error) {
				debug.log(`SPJS Recv (json error):\n  ${msg}`);

				this.consoleLog.appendMsg('SPJS', { Msg: msg, Type: 'Error' });

				this.onParseError(msg);

				return false;

			}

			if (data.Version) {
				this.onVersion(data);

			} else if (data.Commands) {
				this.onCommands(data);

			} else if (data.BufferAlgorithm) {
				this.onBufferAlgorithm(data);

			} else if (data.BaudRate) {
				this.onBaudRate(data);

			} else if (data.Hostname) {
				this.onHostname(data);

			} else if (data.SerialPorts) {
				// this.onSystemAlarm({ er: { fb: 78.02, st: 5, msg: "System alarmed", val: 1 } });
				this.onSerialPorts(data);

			} else if (data.Cmd && data.Cmd === 'Open') {
				// Port connection was opened.
				this.onPortOpen(data);

			} else if (data.Cmd && data.Cmd === 'OpenFail') {
				this.onPortOpenFail(data);

			} else if (data.Cmd && data.Cmd === 'Close') {
				this.onPortClose(data);

			} else if (data.Cmd && data.Cmd === 'Broadcast') {
				this.onBroadcast(data);

			} else if (data.Cmd && data.Cmd === 'WipedQueue') {
				this.onWipedQueue(data);

			} else if (data.Cmd && data.Cmd === 'Queued') {
				// Need to watch for queues being done so we know to send next
				// is it a json queued response or text mode queued response

				// If 'Data' is in the data object, a JSON message got queued.
				if ('Data' in data) {
					this.onQueuedJson(data);

				} else {
					this.onQueuedText(data);

				}

				// Update prog bar of buffer as this would decrement prog bar cuz a dequeue happened.
				this.onQueueCnt(data);

			} else if (data.Cmd && data.Cmd === 'Write') {
				this.onWriteJson(data);

				// Update prog bar of buffer as this would decrement prog bar cuz a dequeue happened.
				this.onQueueCnt(data);

			} else if (data.Cmd && (data.Cmd === 'Complete' || data.Cmd === 'CompleteFake')) {
				this.onCompleteJson(data);

			} else if (data.Cmd && data.Cmd === 'Error') {
				this.onErrorJson(data);

			} else if (data.Error) {
				this.onErrorText(data);

			} else if (data.er) {
				this.onSystemAlarm(data);

			} else if (data.Cmd && data.Cmd === 'FeedRateOverride') {
				this.onFeedRateOverride(data);

			} else if (data.P && data.D) {
				this.onRawPortData(data);

			} else if (data.Addr) {  // Cayenn UDP
				this.onCayenn(data);

			} else if (data.gc) {
				this.onGarbageCollection(data);

			} else if (data.Alloc && data.TotalAlloc) {
				this.onGarbageHeap(data);

			} else if (data.ExecRuntimeStatus) {
				this.onExecRuntimeStatus(data);

			} else if (data.ExecStatus) {
				this.onExecStatus(data);

			} else {

				console.error(`Did nothing with JSON.\n  msg: ${msg}\n  data:${gui.parseObject(data, 4)}`);

				this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Error' });

			}

		} else if (msg.match(/We could not find the serial port/)) {

			console.error(`SPJS Recv (error):\n  ${msg}`);
			console.error('SPJS -Port Not Found-');

			this.consoleLog.appendMsg('SPJS', { Msg: msg, Type: 'Error' });

		// If this msg is an echo of a spjs (aka. non port specific) message, mark the message in the spjs log as received.
		} else {

			// const matchId = this.logCmdStatus('SPJS', {Cmd: msg}, 'Sent');
			const { matchFound, matchId, matchRelated } = this.consoleLog.updateCmd('SPJS', { Msg: msg, Status: 'Sent' });

			// If this message has a match in the console log, it is a SPJS command echo.
			const Type = matchFound ? 'CommandEcho' : 'default';

			this.consoleLog.appendMsg('SPJS', { Msg: msg, Type });

		}
	},
	onSpjsError(error) {

		// If the SPJS is already in an 'error' or 'closed' state, skip DOM updates.
		if (this.SPJS.wsState === 'error' || this.SPJS.wsState === 'closed') {

			debug.groupEnd();

			return false;

		}

		// console.error('WebSocket -onError-' + gui.parseObject(this.SPJS.ws, 2, { keep: ['url', 'bufferedAmount'] }));
		// console.error('WebSocket -onError-');
		debug.groupCollapsed('WebSocket -onError-');

		// Only update the state of the SPJS if it is not already closed.
		this.SPJS.wsState = 'error';
		// debug.log('Web Socket -onSpjsError-' + gui.parseObject(this.SPJS.ws, 2, { keep: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED', 'url', 'readyState', 'bufferedAmount'] }));

		publish('/statusbar-widget/hilite', 'SPJS', 'danger');

		debug.groupEnd();

		return true;

	},
	// IDEA: If the SPJS does not respond to a restart command, force an exit and launch a new SPJS instance.
	onSpjsClose() {

		const that = this;
		const { wsState, wsReconnectDelay, wsReconnectOnExitCmd } = this.SPJS;
		const { verifyMap, errorCmdOnSpjsCloseMaxAge, staleCmdLimit, staleListCmdLimit, findStaleCommands } = this.consoleLog.SPJS;

		// If a reconnect delay has been set, attempt to reconnect to the SPJS after that delay.
		if (wsReconnectDelay !== null) {

			setTimeout(() => that.wsConnect(), wsReconnectDelay);

		}

		// If the SPJS is already in a 'closed' state, launch a new spjs and skip DOM and object updates.
		if (wsState === 'closed') {

			this.launchSpjs();

			return false;

		}

		let { matchFound } = this.consoleLog.updateCmd('SPJS', { Msg: 'exit', Status: 'Completed' });

		// If the SPJS was closed by an exit command and the wsReconnectOnExitCmd flag is set, launch a new SPJS.
		if (matchFound) {

			debug.log('SPJS was shut down because of a \'exit\' command. ');

			if (this.SPJS.wsReconnectOnExitCmd) {
				debug.log('Got a close event. Launching a new SPJS.');

				this.launchSpjs();
			}

		}

		// If the SPJS was closed by a restart command, update the command's status in the log and wait for the SPJS to restart.
		// If that SPJS was not closed by an 'exit' command.
		if (!matchFound) {

			({ matchFound } = this.consoleLog.updateCmd('SPJS', { Msg: 'restart', Status: 'Completed' }));

			if (matchFound) debug.log('SPJS was shut down because of a \'restart\' command.');

		}

		debug.groupCollapsed(`WebSocket -onClose-${gui.parseObject(this.SPJS.ws, 2, { keep: [ 'url', 'bufferedAmount' ] })}`);

		this.SPJS.wsState = 'closed';

		debug.log(`Web Socket -onSpjsClose-${gui.parseObject(this.SPJS.ws, 2, { keep: [ 'CONNECTING', 'OPEN', 'CLOSING', 'CLOSED', 'url', 'readyState', 'bufferedAmount' ] })}`);

		debug.log(`openPorts: ${gui.parseObject(this.SPJS.openPorts)}`);
		debug.log(`openLogs: ${gui.parseObject(this.consoleLog.openLogs)}`);

		// If there are any pending commands in the SPJS, mark them as error (recent to oldest).
		if (verifyMap.length > 0) {

			const timeNow = Date.now();

			for (let i = verifyMap.length - 1; i > 0; i--) {
				// Only mark commands that are more recent than the errorCmdOnSpjsCloseMaxAge setting.
				// this.consoleLog.updateCmd('SPJS', { Id: this.consoleLog.SPJS.logData[verifyMap[i]].Id, MaxAge: this.consoleLog.errorCmdOnSpjsCloseMaxAge, Status: 'Error', Comment: 'SPJS Closed' });

				const { matchFound: matchFound1, matchMsg, matchId, matchIndex, matchTime } = this.consoleLog.findItem('SPJS', { Index: verifyMap[i] });

				if (!matchFound1) continue;

				const matchAge = matchTime - timeNow;

				// if (errorCmdOnSpjsCloseMaxAge === null || matchTime - timeNow < errorCmdOnSpjsCloseMaxAge) {
				// If the message is younger than the maximum age the message can be verified or is the max age is set to zero, give the message a comment of 'SPJS Closed'.
				if ((matchMsg === 'list' && (!staleCmdLimit || matchAge < staleListCmdLimit)) || (matchMsg !== 'list' && (!staleCmdLimit || matchAge < staleCmdLimit))) {

					this.consoleLog.updateCmd('SPJS', { Index: matchIndex, Status: 'Error', Comment: 'SPJS Closed' });

				} else if (findStaleCommands) { // If the message is stale, mark the message as stale.

					this.consoleLog.updateCmd('SPJS', { Index: matchIndex, Status: 'Error', Comment: 'Stale' });

				}

			}

		}

		// Clear the cmdMap and verifyMap since any commands still not executed will not be able to execute now that the SPJS has disconnected/closed.
		this.consoleLog.SPJS.cmdMap = [];
		this.consoleLog.SPJS.verifyMap = [];

		// Hilite the SPJS status indicator in the statusbar red.
		publish('/statusbar-widget/hilite', 'SPJS', 'danger');

		// Close the console logs of any open ports.
		this.portDisconnected(this.consoleLog.openLogs);

		// Remove the port status indicators in the statusbar.
		publish('/statusbar-widget/remove', this.SPJS.openPorts);

		this.SPJS.openPorts = [];
		this.SPJS.portList = {};
		this.SPJS.portMeta = {};

		// Show a warning banner in the serial port list saying that there is no connection to a SPJS.
		$(`#${this.id} .serialport-connection-warning`).addClass('hidden');
		$(`#${this.id} .spjs-connection-warning`).removeClass('hidden');

		this.portListDomUpdate();

		debug.log(`openPorts: ${gui.parseObject(this.SPJS.openPorts)}`);
		debug.log(`openLogs: ${gui.parseObject(this.consoleLog.openLogs)}`);

		debug.groupEnd();

		// Return true so that the caller knows that the SPJS was closed.
		return true;
	},

	onVersion(data) {

		const { Version } = data;

		// Ex. { "Version": "1.92" }

		debug.log(`SPJS -Version-\n  Version: ${Version}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Version' });
		this.consoleLog.updateCmd('SPJS', { Msg: 'version', Status: 'Executed' });

		this.SPJS.version = parseFloat(Version);

	},
	onCommands(data) {
		const { Commands } = data;
		// Ex. { "Commands" : [ "list", "open [portName] [baud]", ... ] }

		debug.log('SPJS -Commands-');

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Commands' });

		this.SPJS.commands = Commands;

	},
	onBufferAlgorithm(data) {
		const { BufferAlgorithm } = data;

		debug.log(`SPJS -BufferAlgorithm-\n BufferAlgorithm: ${BufferAlgorithm}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'BufferAlgorithm' });
		this.consoleLog.updateCmd('SPJS', { Msg: 'bufferalgorithms', Status: 'Executed' });

	},
	onBaudRate(data) {
		const { BaudRate } = data;
		debug.log(`SPJS -BaudRate-\n BaudRate: ${BaudRate}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'BaudRate' });
		this.consoleLog.updateCmd('SPJS', { Msg: 'baudrates', Status: 'Executed' });

	},
	onHostname(data) {
		const { Hostname } = data;
		// Ex. { "Hostname": "BRAYDENS-LENOVO" }

		debug.log(`SPJS -Hostname-\n  Hostname: ${Hostname}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Hostname' });
		this.consoleLog.updateCmd('SPJS', { Msg: 'hostname', Status: 'Executed' });

		this.SPJS.hostname = Hostname;

		this.newspjsSend({ Msg: 'list' });

	},
	onSerialPorts(data) {
		// This method parses the port list data received from the SPJS.

		// Add the message to the SPJS log.
		// let Msg = JSON.stringify(data, null, ' ').replace(/\}$/, ' \}').replace('"AvailableBufferAlgorithms": [ "default", "timed", "nodemcu", "tinyg", "tinyg_old", "tinyg_linemode", "tinyg_tidmode", "tinygg2", "grbl", "marlin" ], ', '');
		const Msg = JSON.stringify(data, null, ' ').replace(/\}$/, ' \}').replace('"AvailableBufferAlgorithms": [\n    "default",\n    "timed",\n    "nodemcu",\n    "tinyg",\n    "tinyg_old",\n    "tinyg_linemode",\n    "tinyg_tidmode",\n    "tinygg2",\n    "grbl",\n    "marlin"\n   ],\n   ', '');

		this.consoleLog.appendMsg('SPJS', { Msg, Type: 'SerialPorts' });

		const that = this;

		// Sort the portList data array by ascending port number. Technically this is not really needed... but ocd ;)
		data = data.SerialPorts.sort((a, b) => Number(a.Name.substring(3)) - Number(b.Name.substring(3)));

		let dataObj = {};
		// Make the port list data into an object.
		for (let i = 0; i < data.length; i++) {
			// The linux platform gives port names like 'dev/ttyAMA0' which messes up the object names and the dom operations.
			const safePort = this.makePortSafe(data[i].Name);

			dataObj[safePort] = {};

			for (let x in data[i]) {

				if (x === 'Name') {
					continue;

				} else if (x === 'RelatedNames') {
					// HACK: just make the first related name safe.
					// FIXME: make a loop to make all related names safe.
					dataObj[safePort][x] = data[i][x] ? [ this.makePortSafe(data[i][x][0]) ] : [ '' ];

				} else {
					dataObj[safePort][x] = data[i][x];

				}

			}
		}

		// Check for errors in the portList (aka. no serial numbers, vid/pid).
		// If any errors are present, discard data and get portList again.
		// Linux os will show ports like '/dev/ttyAMA0' with no assocciated serial number.
		if (hostMeta.platform !== 'linux' && !this.validifyPortList(dataObj)) {
			// console.warn("Got corrupted port list data.");
			debug.log('Got corrupted port list data.');

			// Indicate that the 'list' command has errored in the SPJS console log.
			// This also removes the 'list command from the verifyMap object allowing others 'list' commands to be sent.
			// this.logCmdStatus('SPJS', {Cmd: 'list'}, 'Error');
			this.consoleLog.updateCmd('SPJS', { Msg: 'list', IndexMap: this.consoleLog.SPJS.verifyMap, Status: 'Warning', Comment: 'Corrupt' });

			setTimeout(() => this.newspjsSend({ Msg: 'list', Comment: 'Auto List' }), 500);

			return false;
		}

		// Indicate that the 'list' command has been executed in the SPJS console log.
		// This also removes the 'list command from the verifyMap object allowing others 'list' commands to be sent.
		this.consoleLog.updateCmd('SPJS', { Msg: 'list', Status: 'Executed' });

		debug.groupCollapsed('onSerialPorts');
		debug.log(`SPJS -PortList-${gui.parseObject(dataObj, 2, [ 'DeviceClass', 'IsPrimary', 'AvailableBufferAlgorithms', 'Ver' ])}`);
		debug.table(dataObj);

		// Build the portListDiffs object.
		// If the port list has not changed since the last time it was received, exit the function.
		if (!this.buildPortListDiffs(dataObj)) {

			debug.groupEnd();
			debug.log('PortList not changed.');

			return false;

		}

		debug.log(`PortList changed.${gui.parseObject(this.SPJS.portListDiffs, 2)}`);

		this.SPJS.portList = dataObj;

		const { portListDiffs: diffs, exitUntrustedSpjs, requestListDelay } = this.SPJS;
		let { openLogs } = this.consoleLog;

		// Do object and DOM updates based on how the portList has changed.
		// If any ports have opened/closed, update the openPorts object, and call portConnected()/portDisconnected() if they have not been called yet (aka. when we connect to the SPJS and it already has open ports on it).
		// Normally when a port is opened/closed, portConnected()/portDisconnected() is called by onPortOpen()/onPortClose() in response to an 'open/close port' command from the SPJS.
		if (diffs.opened) {

			debug.log(`diffs.opened: ${gui.parseObject(diffs.opened)}`);

			// this.SPJS.openPorts = this.SPJS.openPorts.concat(diffs.opened);
			this.SPJS.openPorts = [ ...this.SPJS.openPorts, ...diffs.opened ];  // Add the newly opened ports to the list of open ports

			// Sort the openPorts list by port number.
			this.SPJS.openPorts = this.SPJS.openPorts.sort((a, b) => Number(a.substring(3)) - Number(b.substring(3)));

			for (let i in diffs.opened) {

				// If the port has been opened on the SPJS but it's console log has not been opened, initialize the port's console log.
				if (!openLogs.includes(diffs.opened[i])) that.portConnected(diffs.opened[i]);

			}

		}

		if (diffs.closed) {

			// Remove the ports in the actionData object from the openPorts object.
			for (let i in diffs.closed) {

				const port = diffs.closed[i];

				that.SPJS.openPorts.splice(that.SPJS.openPorts.indexOf(port), 1);

				if (openLogs.includes(port)) that.portDisconnected(port);

			}

		}

		// If SPJS has 'no list -> list', hide the warning in the port list DOM.
		if (diffs.SPJS && diffs.SPJS[0] === 'no list -> list') {

			$(`#${this.id} .serialport-connection-warning`).addClass('hidden');

		}

		// If SPJS has 'list -> no list', show the warning in the port list DOM.
		if (diffs.SPJS && diffs.SPJS[0] === 'list -> no list') {

			$(`#${this.id} .serialport-connection-warning`).removeClass('hidden');

		}

		debug.log(`openPorts: ${gui.parseObject(this.SPJS.openPorts)}`);
		debug.log(`openLogs: ${gui.parseObject(this.consoleLog.openLogs)}`);

		debug.groupEnd();

		// If connected to an SPJS that was not launched by the launchSpjs method with no devices active, close the SPJS and launch a new one.
		// debug.log('go:', this.SPJS.go);
		// debug.log('openPorts:', this.SPJS.openPorts);
		if (exitUntrustedSpjs && !this.SPJS.openPorts.length && this.SPJS.go === null) {

			debug.log('Exiting this SPJS and launching a new one.');

			this.newspjsSend({ Msg: 'exit', Comment: 'Untrusted SPJS' });

			// Exit this method to prevent trying to open ports automatically.
			return false;

		}

		// Build the portMeta object based on the portList and deviceMeta objects.
		this.buildPortMeta();

		// If just connected to a SPJS that already had ports open on it, try to send connectScripts to those devices.
		if (diffs.SPJS && diffs.SPJS[0] === 'no list -> list' && this.SPJS.go === null) {

			this.sendConnectScript(this.SPJS.openPorts);

		}

		// Publish the new portList object, portMeta object, and diffs object so that other widgets can react to these changes.
		publish(`/${this.id}/recvPortList`, { PortList: dataObj, PortMeta: this.SPJS.portMeta, Diffs: diffs, OpenPorts: this.SPJS.openPorts, OpenLogs: this.consoleLog.openLogs });

		// If any ports have been added to the SPJS port list, call the update the serial port list in the DOM and try to auto connect to ports.
		if (diffs.added) {

			this.portListDomUpdate();

			// If no ports are currently open, try to auto connect to one.
			this.SPJS.openPorts.length || this.autoConnectPorts();

		}

		// If any ports have been removed from the SPJS port list, call the update the serial port list in the DOM.
		if (diffs.removed) {

			this.portListDomUpdate();

		}

		// If there are no ports on SPJS and requestListDelay is set, request a new list.
		if (!this.SPJS.openPorts.length && requestListDelay) {

			setTimeout(() => that.newspjsSend({ Msg: 'list', Comment: 'Auto List' }), requestListDelay);

		}

		debug.log(`openPorts: ${gui.parseObject(this.SPJS.openPorts)}`);
		debug.log(`openLogs: ${gui.parseObject(this.consoleLog.openLogs)}`);

		return true;

	},
	validifyPortList(data) {
		// This method checks that port list data received from the SPJS is not corrupted.
		debug.log('Validating port list data.');

		const that = this;
		const requiredProp = [ 'SerialNumber', 'UsbPid', 'UsbVid' ];

		// Check that each property in the requiredProp array has an associated value for each port in the portList object.
		for (let i in data) {
			for (let x = 0; x < requiredProp.length; x++) {
				// If port list data is corrupted, return 'false'.
				if (!data[i][requiredProp[x]]) {
					return false;
				}
			}
		}

		// Return 'true' to indicate that data is valid.
		return true;
	},
	buildPortListDiffs(data) {
		debug.log('Finding diffs in list data.'); // ...since 1903
		// debug.log("this.SPJS.portList:", this.SPJS.portList);

		const { portList } = this.SPJS;
		const diffs = this.SPJS.portListDiffs = {};

		// The dataCount and portListCount properties are used to count how many ports are in the new and old port list data, respectively.
		let dataCount = 0;
		let portListCount = 0;

		for (let port in data) {
			dataCount += 1;
			// If this port is not in portList, port was added.
			if (!portList[port]) {
				if (!diffs.added) diffs.added = [];
				diffs.added.push(port);
			}

			for (let i in data[port]) {
				// debug.log("  " + i + ": " + gui.parseObject(data[port][i], ""));
				if (i === 'IsOpen' && data[port][i] && (!portList[port] || !portList[port][i])) {
					if (!diffs.opened) diffs.opened = [];
					diffs.opened.push(port);
				} else if (i === 'IsOpen' && !data[port][i] && portList[port] && portList[port][i]) {
					if (!diffs.closed) diffs.closed = [];
					diffs.closed.push(port);
				} else if (i === 'FeedRateOverride' && portList[port] && data[port][i] !== portList[port][i]) {
					if (!diffs.feedrate) diffs.feedrate = [];
					diffs.feedrate.push(port);
				}
			}
		}

		for (let port in portList) {
			portListCount += 1;
			// If this port is not in the new port list, the port was removed.
			if (!data[port]) {
				if (!diffs.removed) diffs.removed = [];
				diffs.removed.push(port);
			}
			// If this port was removed from the SPJS and it was open.
			if (!data[port] && portList[port].IsOpen) {
				if (!diffs.closed) diffs.closed = [];
				diffs.closed.push(port);
			}
		}

		if (diffs && (!portListCount || !dataCount)) {
			diffs.SPJS = [ `${portListCount ? 'list' : 'no list'} -> ${dataCount ? 'list' : 'no list'}` ];
		}

		return diffs;
	},
	buildPortMeta() {

		debug.groupCollapsed('Building portMeta');

		// Builds the portMeta object based on the portList object and using information from the deviceMeta object.
		// The portMeta object is used to determine which port to automatically connect to, and is used with portList to build the serial port list in the DOM.
		const that = this;
		const { deviceMeta } = this;
		const { portList, portMeta } = this.SPJS;

		let portMetaObj = {};
		let matchIndex = 0;
		let portListUpdate = false;

		// Loop through each port object in the received serial ports object.
		for (let port in portList) {
			debug.log(`Port ${port}`);

			// Loop through each meta in the deviceMeta object and check if it matches the current port in the serial ports list.
			metaLoop: for (let i = 0; i < deviceMeta.length; i++) {
				debug.log(`  i: ${i}`);

				// Loop through each Vid/Pid in the current deviceMeta and check for match against Vid/Pid in received port data.
				for (let x = 0; x < deviceMeta[i].VidPids.length; x++) {
					debug.log(`    x: ${x}`);

					// If the Vid/Pids from the deviceMeta match the received port's Vid/Pids.
					if (deviceMeta[i].VidPids[x].Vid.toLowerCase() === portList[port].UsbVid.toLowerCase() && deviceMeta[i].VidPids[x].Pid.toLowerCase() == portList[port].UsbPid.toLowerCase()) {

						matchIndex = i;

						// If this port has any related ports.
						if (portList[port].RelatedNames) {

							let a = Number(port.replace(/com|fs-dev-fs-tty\D{3}/i, ''));
							let b = Number(portList[port].RelatedNames[0].replace(/com|fs-dev-fs-tty\D{3}/i, ''));

							debug.log(`a: ${a}\nb: ${b}`);

							// If this port is greater than it's related port, use the next meta object in the deviceMeta array.
							if (a > b && matchIndex < deviceMeta.length - 1 && JSON.stringify(deviceMeta[i].VidPids) === JSON.stringify(deviceMeta[i + 1].VidPids)) {
								matchIndex += 1;
								debug.log(`      ++i: ${matchIndex}`);
							}
						}

						debug.log(`      break. [${deviceMeta[matchIndex].Friendly}]`);
						debug.log(`index: ${matchIndex}\ndeviceMeta: `, deviceMeta[matchIndex]);

						// Exit the search for meta data becuase a match was found.
						break metaLoop;

					// If the Vid/Pid are empty strings, set the meta as the default meta data.
					} else if (deviceMeta[i].VidPids[x].Vid === '' && deviceMeta[i].VidPids[x].Pid === '') {
						matchIndex = i;
						debug.log(`      default. [${deviceMeta[matchIndex].Friendly}]`);
					}
				}
			}

			const matchItem = deviceMeta[matchIndex];
			const matchFriendly = matchItem.useReceivedFriendly ? portList[port].Friendly.split('(COM')[0] : matchItem.Friendly;
			// debug.log(`useReceivedFriendly: ${matchItem.useReceivedFriendly}\nmatchFriendly: ${matchFriendly}`);
			const matchBaud = portList[port].Baud || matchItem.Baud;
			const matchBuffer = portList[port].Buffer || matchItem.Buffer;

			// If the info in the portMeta object has changed, perform a DOM update on the serial ports list.
			if (portMeta[port] && (matchBaud !== portMeta[port].Baud || matchBuffer !== portMeta[port].Buffer)) {
				portListUpdate = true;
				debug.log('Will update port list DOM.');
			}

			const lineEndings = this.consoleLog.lineEndings;
			const defaultLineEnding = this.consoleLog.defaultLineEnding;

			portMetaObj[port] = {
				metaIndex: matchIndex,
				Friendly: matchFriendly,
				Baud: matchBaud,
				Buffer: matchBuffer,
				autoConnectPort: matchItem.autoConnectPort,
				portMuted: matchItem.portMuted,
				lineEnding: matchItem.lineEnding ? lineEndings[matchItem.lineEnding] : lineEndings[defaultLineEnding]
			};

		}

		this.SPJS.portMeta = portMetaObj;

		portListUpdate && this.portListDomUpdate();

		debug.log(`Built -portMeta-${gui.parseObject(this.SPJS.portMeta, 2)}`);
		debug.groupEnd();

	},
	portListDomUpdate() {
		// TODO: Make portListDomUpdate accept arguments to make updates more efficient. (aka. only update what is needing to be changed rather that rebuilding the entire DOM list everytime.)
		debug.groupCollapsed('Updating port list DOM');

		const that = this;
		const portList = this.SPJS.portList;
		const portMeta = this.SPJS.portMeta;

		let listHtml = '<tbody>';

		// Build the new DOM code.
		for (let port in portList) {

			let classItem = `${listHtml == '<tbody>' ? ' first-item' : ''}${portMeta[port].portMuted ? ' text-muted' : ''}`;
			let portHtml = `<tr evt-data="${port}" class="port-list-item port-${port}${classItem}${portList[port].IsOpen ? ' success' : ''}">`;

			portHtml += `<td class="port-toggle-btn"><span class="fa fa-toggle-${portList[port].IsOpen ? 'on' : 'off'}"></span></td>`;
			portHtml += `<td class="port-name">${this.makePortUnSafe(port)}</td>`;
			portHtml += `<td class="port-friendly">${portMeta[port].Friendly}</td>`;
			portHtml += `<td class="port-baud">${portMeta[port].Baud}</td>`;
			portHtml += `<td class="port-buffer">${portMeta[port].Buffer}</td>`;
			// portHtml += '<td class="">' + portMetaItem.Buffer + '</td>';
			portHtml += '</tr>';

			listHtml += portHtml;

			debug.log(`Port ${port}${(portMeta[port].portMuted ? ' [muted]' : '')}:`, portHtml);

		}

		listHtml += '</tbody>';

		// Update the DOM.
		$(`#${this.id} .serial-port-list`).html(listHtml);
		this.resizeWidgetDom();

		debug.groupEnd();

	},
	autoConnectPorts() {
		debug.groupCollapsed('Auto-Connect Ports');

		const that = this;
		const portList = this.SPJS.portList;
		const portMeta = this.SPJS.portMeta;

		for (let port in portMeta) {
			// debug.log("Port " + portMeta[port].Name + gui.parseObject(portMeta[port], 2));
			// If the port's autoConnectPort property is 'true', and the port is not already open, send an 'open' command to the SPJS.
			const unsafePort = this.makePortUnSafe(port);

			if (portMeta[port].autoConnectPort && !portList[port].IsOpen) {
				debug.log(`Port '${unsafePort}' ...connecting`);

				const Msg = `open ${unsafePort} ${portMeta[port].Baud} ${portMeta[port].Buffer}`;

				this.newspjsSend({ Msg });

			} else if (portList[port].IsOpen) {
				debug.log(`Port '${unsafePort}' ...already open`);

			} else {
				debug.log(`Port '${unsafePort}' ...nope`);
			}
		}

		debug.groupEnd();
	},
	sendConnectScript(data) {
		// The sendConnectScript method sends connect scripts to devices that were already opened on an SPJS that was just connected to.
		// Connect scripts are used to get information or the status of the device that may not be received otherwise since the device was already opened on the SPJS.
		// This method uses recursion to send scripts to multiple ports passed in the data argument as an array.
		// Arg. Data [string] or [array[string]] - Specifies the ports to try sending connect scripts to (eg. 'COM7' or [ 'COM5', 'COM7', 'COM11' ]).

		// Debugging purposes.
		if (typeof data == 'undefined') debug.error('wtf are you soking?? If you are going to call this method, at least tell it to do something rather than just trolling the crap outta it.');

		let port = '';

		// If the data argument was passed a single port name (eg. 'COM7').
		if (data && typeof data == 'string') {
			port = data;

		// If the data argument was passed multiple port names as an array (eg. [ 'COM5', 'COM7', 'COM11' ]).
		} else if (data && Array.isArray(data) && data.length) {

			// Shift the first element from the array into port.
			const [ a, ...b ] = data;

			port = a;

			b.length && this.sendConnectScript(b);  // If there are elements left in the data array, recursively call this method.

		} else if (data && Array.isArray(data) && !data.length) {

			debug.error('The data argument is an empty array. Thats about as useful as this error message (aka. not real useful but you gotta figure out wth went wrong).');

		}

		if (port === '')
			debug.error('derp :P   ...port is an empty string.');

		if (port === 'SPJS')  // If the port is the SPJS
			return false;

		debug.groupCollapsed('Sending connect scripts to device.');
		debug.log(`Connect scripts for ${port}.`);

		// const { metaIndex, Friendly, Baud, Buffer, autoConnectPort, portMuted } = this.SPJS.portMeta[port];
		const portMeta = this.SPJS.portMeta[port];
		const portData = this.SPJS.portList[port];

		// Scan through the initScripts array for a match with the port information.
		for (let i = 0; i < this.connectScripts.length; i++) {

			debug.log(`i: ${i}`);

			let misMatch = 0;
			let scriptItem = this.connectScripts[i];

			Object.keys(scriptItem).forEach((key, index) => {

			    // key: the name of the object key
			    // index: the ordinal position of the key within the object
				debug.log(`key: ${key}`);

				// Check for a match if this is device info.
				if (key !== 'script' && key !== 'pause') {

					if ((key === 'Friendly' || key === 'Baud' || key === 'Buffer') && scriptItem[key] !== portMeta[key])
						misMatch += 1;

					else if (key === 'SerialNumber' && scriptItem[key] !== portData[key])
						misMatch += 1;

				}

			});

			if (!misMatch) {  // If there is no mis-matching info (ie. if a match was found), send the script.

				debug.groupEnd();

				// Return so that the caller knows that init scripts were sent successfully.
				return this.newportSendJson(port, { Data: scriptItem.script, Id: 'connect0', Pause: scriptItem.pause });

			}

		}

		debug.groupEnd();

		debug.log(`sendConnectScript\n  openPorts: ${this.SPJS.openPorts}`);

		return false;

	},
	onPortOpen(data) {

		const { Cmd, Desc, Port, IsPrimary, Baud, BufferType } = data;

		// Ex. { Cmd: "Open", Desc: "Got register/open on port.", Port: "COM10", IsPrimary: true, Baud: 115200, BufferType: "tinygg2" }

		debug.log(`SPJS -PortOpen-${gui.parseObject(data, 2)}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		const portMeta = this.SPJS.portMeta;
		const safePort = this.makePortSafe(Port);

		let refCmd = `open ${Port} ${Baud}${BufferType ? ` ${BufferType}` : ''}`;

		let { matchFound } = this.consoleLog.updateCmd('SPJS', { Msg: refCmd, Status: 'Executed' });

		// If this was caused by an 'open' command in the SPJS, set the status of that command to 'Executed'.
		if (!matchFound) this.consoleLog.updateCmd('SPJS', { PartMsg: `open ${Port}`, Status: 'Executed' });

		// If the port was opened with different settings from the deviceMeta data, update the serial ports list DOM.
		if (Baud !== portMeta[safePort].Baud || BufferType !== portMeta[safePort].Buffer) {

			// If a Baud value was given, update the device's portMeta object.
			portMeta[safePort].Baud = Baud || portMeta[safePort].Baud;
			portMeta[safePort].Buffer = BufferType || portMeta[safePort].Buffer;

			this.portListDomUpdate();

		}

		this.portConnected(safePort);
		this.sendPortInits(safePort);

		// Get port list to keep the portList object up to date.
		// Use a delay to avoid getting corrupted port list data.
		setTimeout(() => this.newspjsSend({ Msg: 'list' }), 250);

	},
	portConnected(port) {  // The portConnected method handles all the DOM and object updates required whenever a port is connected.

		// let port = '';
		let nextPort = null;

		// If the port argument is [array], this function will be ran once for each port in the array.
		if (typeof port == 'object') {
			nextPort = [ ...port ];
			port = nextPort.shift();
		}
		// if (typeof port == 'object') [ port, ...nextPort ] = data;
		// else if (typeof port == 'string') port = data;

		// If the port argument is 'SPJS', exit the method.
		if (port === 'SPJS') return false;

		debug.groupCollapsed(`Port Connected: ${port}`);
		const that = this;

		// If this port is already initiated (ie. this method was called redundantly), skip all DOM and object updates.
		if (typeof this.consoleLog[port] != 'undefined' && this.consoleLog.openLogs.indexOf(port) !== -1) {

			debug.log(`portConnected was already called for this port.${gui.parseObject(this.consoleLog, 2)}`);

		} else {  // If this method was not called redundantly, update objects and DOM elements.

			// Remove any hilites on the port in the serial device list.
			$(`#${this.id} .splist .port-${port}`).removeClass('success warning');
			// Change the toggle-on button into a toggle-off button in the serial device list.
			$(`#${this.id} .splist .port-${port} .port-toggle-btn > span`).removeClass('fa-toggle-on').addClass('fa-toggle-off');

			// If this port's console log is visible, make the spjs' console log visible.
			if (port === this.consoleLog.activeLog) {
				// debug.log("This port's console log was visible.");
				this.consoleLogChangeView('SPJS');
			}

			// Remove the respective port's console log output <div> element.
			$(`#${this.id} .console-log-panel .nav-tabs .list-tab-${port}`).remove();
			// Remove the respective port's console log tab.
			$(`#${this.id} .console-log-panel .panel-body .log-${port}`).remove();

			// Hilite the port green in the serial devices list.
			$(`#${this.id} .splist .port-${port}`).addClass('success');
			// Change the toggle-off button into a toggle-on button in the serial devices list.
			$(`#${this.id} .splist .port-${port} .port-toggle-btn > span`).removeClass('fa-toggle-off').addClass('fa-toggle-on');

			// Update and sort the openLogs object. Sort the SPJS element to the end of the array.
			// IDEA: Use .splice() to add this port to the openLogs array so it does not need to be sorted everytime and use .localCompare() to know where it should be added.
			this.consoleLog.openLogs.unshift(port);

			this.consoleLog.openLogs = this.consoleLog.openLogs.sort((a, b) => {

				const x = (a === 'SPJS') ? 999 : Number(a.substring(3));
				const y = (b === 'SPJS') ? 999 : Number(b.substring(3));

				return x - y;

			});

			// const origional = { a: 1, b: 2 };
			const { msgShowDefault } = this.consoleLog;
			// const msgShowDefault = { ...this.consoleLog.msgShowPortDefault };

			// HTML for the console log tab.
			let consoleLogTabHtml = '';
			consoleLogTabHtml += `<li role="presentation" class="list-tab-${port}">`;
			consoleLogTabHtml += `<span evt-data="${port}" class="console-log-tab">${this.makePortUnSafe(port.replace(/fs-dev-fs-tty/i, ''))}</span></li>`;

			// HTML for the console log panel.
			let consoleLogOutputHtml = `<div class="console-log-output log-${port} hidden"></div>`;

			// Build the console log DOM based on the openLogs array.
			for (let i = this.consoleLog.openLogs.indexOf(port) + 1; i < this.consoleLog.openLogs.length; i++) {
				// debug.log("openLogs[" + i + "]: " + that.consoleLog.openLogs[i]);
				publish('/statusbar-widget/add', port, this.makePortUnSafe(port.replace(/fs-dev-fs-tty/i, '')), 'success', that.consoleLog.openLogs[i]);

				$(`#${that.id} .console-log-panel .nav-tabs .list-tab-${that.consoleLog.openLogs[i]}`).before(consoleLogTabHtml);
				$(`#${that.id} .console-log-panel .panel-body .log-${that.consoleLog.openLogs[i]}`).before(consoleLogOutputHtml);

				break;

			}

			// Build the port log object (Must do this after building the log panel in the DOM so that the JQuery DOM reference can be made).
			this.consoleLog[port] = {
				logData: [],
				cmdMap: [],
				verifyMap: [],
				logPanelDOM: $(`#connection-widget .console-log-panel .log-${port}`),
				value: '',
				inputStatus: null,
				cmdCount: 0,
				history: [],
				historyRecallIndex: null,
				placeholder: `GCode ${this.makePortUnSafe(port.replace(/fs-dev-fs-tty/i, ''))}`,
				msgShow: Object.assign({}, msgShowDefault)
			};

			this.dataSendBuffer[port] = [];

			// Call a  resize on the DOM elements so that 'style="height: ---px;"' is added to the console log's DOM element to ensure that scroll bars are created properly..
			this.resizeWidgetDom();

			debug.log(`openLogs: ${gui.parseObject(this.consoleLog.openLogs)}`);

			// If this port's raw data buffer is undefined, define it.
			if (typeof this.dataRecvBuffer[port] == 'undefined') {
				this.dataRecvBuffer[port] = '';

			// If this port's raw data buffer is already defined, call onRawPortData method to add the raw data to this port's log.
			} else {
				this.parseRawPortData(port);

			}

			// If the temporary data buffer was used to buffer data until the port officially opened, transfer that data to the dataRecvBuffer object.
			// if (this.tempDataRecvBuffer[port]) {
			// 	this.dataRecvBuffer[port] = this.tempDataRecvBuffer[port];
			// 	delete this.tempDataRecvBuffer[port];
			// }

		}

		debug.groupEnd();

		// If the port argument was passed as [array], run the portConnected method for the next element in the port array.
		if (nextPort && nextPort.length && nextPort !== 'SPJS') this.portConnected(nextPort);

		return true;

	},
	portDisconnected(port) {  // The portDisconnected method handles all of the DOM and object updates required whenever a port is disconnected.

		// let port = '';
		let nextPort = null;

		// If the port argument is [array], this function will be ran once for each port in the array.
		if (typeof port == 'object') {
			nextPort = [ ...port ];
			port = nextPort.shift();
		}
		// if (typeof port == 'object') [ port, ...nextPort ] = data;
		// else if (typeof port == 'string') port = data;

		// If the port argument is 'SPJS', exit the method.
		if (port === 'SPJS') return false;

		debug.groupCollapsed(`Port Disconnected: ${port}`);

		let that = this;
		const { removeLogOnClose } = this.consoleLog;

		// If this port is already un-initiated (aka. this function was called redundantly), skip all DOM and object updates.
		if (typeof this.consoleLog[port] == 'undefined' && !this.consoleLog.openLogs.includes(port)) {
			debug.log(`portDisconnected has already been called for this port.${gui.parseObject(this.consoleLog, 2)}`);

		// If this method was not redundantly called, update objects and DOM elements.
		} else {

			// Update the openPorts array.
			// IDEA: Use .splice() to remove this port from the openLogs array.
			let openLogs = [];

			for (let i = 0; i < this.consoleLog.openLogs.length; i++) {

				if (that.consoleLog.openLogs[i] !== port) {

					openLogs = openLogs.concat(that.consoleLog.openLogs[i]);

				}

			}

			this.consoleLog.openLogs = openLogs;

			// Remove the respective port from the statusbar.
			publish('/statusbar-widget/remove', port);
			// publish('/statusbar-widget/hilite', "serialport-a", "danger");

			// Remove any hilites on the port in the serial device list.
			$(`#${this.id} .splist .port-${port}`).removeClass('success warning');
			// Change the toggle-on button into a toggle-off button in the serial device list.
			$(`#${this.id} .splist .port-${port} .port-toggle-btn > span`).removeClass('fa-toggle-on').addClass('fa-toggle-off');

			// If this port's console log is visible, make the spjs' console log visible.
			if (port === this.consoleLog.activeLog) {

				this.consoleLogChangeView('SPJS');

			}

			// If the removeLogOnClose flag is false, the following DOM updates will be done if/when the port is next opened (in the portConnected method).
			if (removeLogOnClose) {

				// Remove the respective port's console log output <div> element.
				$(`#${this.id} .console-log-panel .nav-tabs .list-tab-${port}`).remove();
				// Remove the respective port's console log tab.
				$(`#${this.id} .console-log-panel .panel-body .log-${port}`).remove();

				// Delete the respective port's consoleLog and dataRecvBuffer objects.
				delete this.consoleLog[port];
				delete this.dataRecvBuffer[port];
				delete this.dataSendBuffer[port];

			}

			// debug.log("openLogs: " + gui.parseObject(this.consoleLog.openLogs));
			// debug.log("openLogs: ", this.consoleLog);
			// debug.log("consoleLog.length: ", this.consoleLog.length);

		}

		debug.groupEnd();

		if (nextPort && nextPort.length && nextPort !== 'SPJS') this.portDisconnected(nextPort);

		return true;

	},
	onPortOpenFail(data) {

		const { Cmd, Port, Baud, Desc } = data;

		// Ex. { Cmd: "OpenFail", Desc: "Error opening port. The system cannot find the file specified.", Port: "COM69", Baud: 115200 }

		debug.log(`SPJS -PortOpenFail-\n  Cmd: ${Cmd}\n  Port: ${Port}\n  Baud: ${Baud}\n  Desc: ${Desc}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		const safePort = this.makePortSafe(Port);
		const { requestListDelay } = this.SPJS;

		// If the port was open, set the unverified commands in it's console log to 'Error'.
		if (typeof this.consoleLog[safePort] != 'undefined') {

			const verifyMap = this.consoleLog[safePort].verifyMap;

			const refCmd = `open ${Port}`;

			// It this was caused by an 'open' command in the SPJS, set the status of that command to 'Error'.
			verifyMap.length && this.consoleLog.updateCmd('SPJS', { PartMsg: refCmd, IndexMap: verifyMap, Status: 'Error' });

		}

		this.portDisconnected(safePort);

		// Repeatedly attempt to connect to a port.
		requestListDelay && setTimeout(() => this.newspjsSend({ Msg: 'list' }), requestListDelay);

	},
	onPortClose(data) {

		const { Cmd, Desc, Port, Baud } = data;

		// Ex. {Cmd: "Close", Desc: "Got unregister/close on port.", Port: "COM10", Baud: 115200}

		debug.log(`SPJS -PortClose-\n  Cmd: ${data.Cmd}\n  Port: ${data.Port}\n  Baud: ${data.Baud}\n  Desc: ${data.Desc}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		const safePort = this.makePortSafe(Port);

		const refCmd = `close ${Port}`;

		const { matchFound, matchType } = this.consoleLog.updateCmd('SPJS', { PartMsg: refCmd, Type: 'MdiCommand', Status: 'Executed' });

		// If the port closed because of a SPJS mdi command, prevent the port from autoconnecting again.
		if (matchFound) {
			// FIXME: Fix this.
			// FIXME: This is weird, the port doesnt autoconnect even though there is no code here.
			this.deviceMeta[this.SPJS.portMeta[safePort].metaIndex].autoConnectPort = false;

			debug.log(`Clearing auto-connect on: ${Port}`);

		// If the port closed because of a SPJS command.
		} else if (this.consoleLog.updateCmd('SPJS', { PartMsg: refCmd, Status: 'Executed' })) {


		// If the port did not close because of a SPJS command, we know that the port disconnected unexpectedly.
		} else {
			// console.warn(`Port ${port} disconnected unexpectedly.`);

			// IDEA: Publish the unexpected port close event so that other widgets can respond accordingly.

		}

		this.portDisconnected(safePort);

		// Get port list to keep the portList object up to date.
		// Use a delay to avoid getting corrupted port list data.
		setTimeout(() => this.newspjsSend({ Msg: 'list' }), 250);

	},
	sendPortInits(port) {

		debug.groupCollapsed('Sending init scripts to device.');
		debug.log(`Init scripts for ${port}.`);

		// const { metaIndex, Friendly, Baud, Buffer, autoConnectPort, portMuted } = this.SPJS.portMeta[port];
		const meta = this.SPJS.portMeta[port];
		const portData = this.SPJS.portList[port];

		// Scan through the initScripts array for a match with the port information.
		for (let i = 0; i < this.initScripts.length; i++) {

			debug.log(`i: ${i}`);

			const scriptItem = this.initScripts[i];
			const scriptItemKeys = Object.keys(scriptItem);

			let matchFound = true;

			// Check if this init script should be used.
			for (let j = 0; j < scriptItemKeys.length; j++) {

				const keyItem = scriptItemKeys[j];
				const keyItemValue = scriptItem[keyItem];

				debug.log(`keyItem: ${keyItem}`);

				if (keyItem !== 'script' && keyItem !== 'pause') {

					if ((keyItem === 'Friendly' || keyItem === 'Baud' || keyItem === 'Buffer') && scriptItem[keyItem] !== meta[keyItem]) {
						matchFound = false;

					} else if (keyItem === 'SerialNumber' && scriptItem[keyItem] !== portData[keyItem]) {
						matchFound = false;

					} else if (keyItem === 'HostName' && scriptItem[keyItem] !== hostMeta.hostName) {
						matchFound = false;

					}

				}

			}

			// If all the conditions of this script match, send this script to this port.
			if (matchFound) {

				debug.groupEnd();

				// Return so that the caller knows that init scripts were sent.
				return this.newportSendJson(port, { Data: scriptItem.script, Id: 'init0', Pause: scriptItem.pause });

			}

		}

		debug.groupEnd();

		return false;

	},
	onBroadcast(data) {

		const { Cmd, Msg } = data;

		// Ex. {Cmd: "Broadcast", Msg: "helloworld↵"}

		debug.log(`SPJS -Broadcast-\n  Cmd: ${Cmd}\n  Msg: ${Msg}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		this.consoleLog.updateCmd('SPJS', { PartMsg: 'broadcast', Status: 'Executed' });

	},
	onWipedQueue(data) {

		const { Cmd, QCnt, Port } = data;

		// Ex. { "Cmd": "WipedQueue", "QCnt": 0, "Port": "COM10" }

		debug.log(`SPJS -WipedQueue-\n  Cmd: ${Cmd}\n  QCnt: ${QCnt}\n  Port: ${Port}`);

		// Add the mess age to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		const safePort = this.makePortSafe(Port);

	},
	onQueuedJson(data) {

		const { Cmd, QCnt, P, Data } = data;

		// Ex. { "Cmd": "Queued", "QCnt": 1, "P": "COM10", "Data": [{ "D": "\n", "Id": "startup1", "Pause": 0 }] }
		// Ex. { "Cmd": "Queued", "QCnt": 2, "P": "COM10", "Data": [{ "D": "$sys\n", "Id": "console18", "Pause": 0 }, { "D": "{"ej":""}\n", "Id": "console18-part-2-2", "Pause": 0 }] }

		debug.log(`SPJS -QueuedJson-${gui.parseObject(data, 2)}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		const safePort = this.makePortSafe(P);

		for (let i = 0; i < Data.length; i++) {

			// If a command was sent in one line that the device parses as two lines, it will add a suffix to the command's id like: 'com10n7' -> 'com10n7-part-1-2' and 'com10n7-part-1-2'.
			// If there is no Id, the message may have been sent as a non-buffered command which does not send an associated id.
			const [ refId ] = Data[i].Id.split('-part');

			let matchFound = false;

			refId || ({ matchFound } = this.consoleLog.updateCmd(safePort, { Id: refId, Status: 'Queued', UpdateRelated: true }));

			if (matchFound) continue;

			({ matchFound } = this.consoleLog.updateCmd(safePort, { Msg: Data[i].D, Status: 'Queued', UpdateRelated: true }));

			if (matchFound) continue;

			({ matchFound } = this.consoleLog.updateCmd(safePort, { PartMsg: Data[i].D, Status: 'Queued', UpdateRelated: true }));

			if (matchFound) continue;

			// The command could have been sent as mdi from the spjs which means that it wouldnt show up in the port's log.
			({ matchFound } = this.consoleLog.updateCmd('SPJS', { PartMsg: Data[i].D, Status: 'Queued', UpdateRelated: true }));

			if (!matchFound) debug.log(`No match was found for Msg: '${Data[i].D}', Id: '${Data[i].Id}'`);

		}

	},
	// TODO: Test that it works when receiving multiple commands at a time where a list of data and ids are received.
	onQueuedText(data) {

		const { Cmd, QCnt, Ids, D, Port } = data;

		// Ex. { "Cmd": "Queued", "QCnt": 2, "Ids": [ "" ], "D": [ "!" ], "Port": "COM5" }

		debug.log(`SPJS -QueuedText-\n  Cmd: ${Cmd}\n  QCnt: ${QCnt}\n  Ids: %O\n  D: %O\n  Port: ${Port}`, Ids, D);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		const safePort = this.makePortSafe(Port);

		for (let i = 0; i < D.length; i++) {

			// If a command was sent in one line that the device parses as two lines, it will add a suffix to the command's id like: 'com10n7' -> 'com10n7-part-1-2' and 'com10n7-part-1-2'.
			// If there is no Id, the message may have been sent as a non-buffered command which does not send an associated id.
			const [ refId ] = Ids[i].split('-part');

			let matchFound = false;

			refId || ({ matchFound } = this.consoleLog.updateCmd(safePort, { Id: refId, Status: 'Queued', UpdateRelated: true }));

			if (matchFound) continue;

			({ matchFound } = this.consoleLog.updateCmd(safePort, { Msg: D[i], Status: 'Queued', UpdateRelated: true }));

			if (matchFound) continue;

			({ matchFound } = this.consoleLog.updateCmd(safePort, { PartMsg: D[i], Status: 'Queued', UpdateRelated: true }));

			if (matchFound) continue;

			// The command could have been sent as mdi from the spjs which means that it wouldnt show up in the port's log.
			({ matchFound } = this.consoleLog.updateCmd('SPJS', { PartMsg: D[i], Status: 'Queued', UpdateRelated: true }));

			if (!matchFound) debug.log(`No match was found for Msg: '${D[i]}', Id: '${Ids[i]}'`);

		}

	},
	onWriteJson(data) {

		const { Cmd, QCnt, Id, P } = data;

		// Ex. { "Cmd": "Write", "QCnt" :0, "Id": "startup1", "P": "COM10" }
		// Ex. { "Cmd": "Write", "QCnt": 1, "Id": "console18", "P": "COM10" }
		// Ex. { "Cmd": "Write", "QCnt": 0, "Id": "console18-part-2-2", "P": "COM10" }
		// Ex. { "Cmd": "Write", "QCnt": 0, "Id": "", "P": "COM10" } <- from send text instead of json.
		// Ex. { "Cmd": "Write", "QCnt": 1, "Id": "", "P": "COM5" }

		debug.log(`SPJS -WriteJson-${gui.parseObject(data, 2)}`);
		// debug.log("SPJS -WriteJson-\n  Cmd: " + data.Cmd + "\n  QCnt: " + data.QCnt + "\n  Id: " + data.Id + "\n  Port: " + data.P);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		// See if we have an Id in the resposne, if so it is from a json send and we need to see the response.
		// If there is no id, look for a recent command sent without buffering.
		if (Id === '') {

			// The message could be from a recent sendNoBuf command.
			const refMsg = `sendnobuf ${P}`;
			const { logData, cmdMap, verifyMap } = this.consoleLog.SPJS;

			let matchFound = false;

			// This is my newer method of verifying messages without Ids.
			if (verifyMap && verifyMap.length) ({ matchFound } = this.consoleLog.updateCmd('SPJS', { PartMsg: refMsg, Status: 'Written', SearchFrom: logData.length - 1, SearchBackwards: true, IndexMap: verifyMap }));

			if (matchFound) return;

			// This is what i had the first time i wrote this code and left it in here cuz why not.
			({ matchFound } = this.consoleLog.updateCmd(P, { Meta: 'portSendNoBuf', Status: 'Written', UpdateRelated: true }));

			if (!matchFound) debug.log('No match found searching for portSendNoBuf commands.');

			return;

		}

		const safePort = this.makePortSafe(P);
		const [ refId ] = Id.split('-part');

		// Look for and try to verify the command in the port's console log using the received Id.
		let { matchFound } = this.consoleLog.updateCmd(safePort, { Id: refId, Status: 'Written', UpdateRelated: true });

		if (matchFound) return;

		// Look for and try to verify the command in the SPJS console log using the received Id.
		({ matchFound } = this.consoleLog.updateCmd('SPJS', { Id: refId, Status: 'Written' }));


	},
	onCompleteJson(data) {

		const { Cmd, Id, P } = data;

		// Ex. { "Cmd": "Complete", "Id": "internalInit0", "P": "COM10" }
		// Ex. { "Cmd": "CompleteFake", "Id": "console18", "P": "COM10" }
		// Ex. { "Cmd": "Complete", "Id": "console18-part-2-2", "P": "COM10" }
		// Ex. { "Cmd": "CompleteFake", "Id": "", "P": "COM5" } <- from send text instead of json.

		debug.log(`SPJS -CompleteJson-\n  Cmd: ${Cmd}\n  Id: ${Id}\n  Port: ${P}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		const safePort = this.makePortSafe(P);
		const [ refId ] = Id.split('-part');

		let matchFound = false;

		refId && ({ matchFound } = this.consoleLog.updateCmd(safePort, { Id: refId, Status: 'Completed', UpdateRelated: true }));

		if (matchFound) return true;

		refId && ({ matchFound } = this.consoleLog.updateCmd('SPJS', { Id: refId, Status: 'Completed' }));

		if (matchFound) return true;

		// The message could be from a recent sendNoBuf command.
		const refMsg = `sendnobuf ${P}`;
		const { logData, cmdMap, verifyMap } = this.consoleLog.SPJS;

		if (refId === '' && verifyMap && verifyMap.length) {

			({ matchFound } = this.consoleLog.updateCmd('SPJS', { PartMsg: refMsg, Status: 'Completed', SearchFrom: logData.length - 1, SearchBackwards: true, IndexMap: verifyMap }));

		}

		if (matchFound) return true;

		debug.log(`No match was found for Id: '${Id}'`);

		return false;

	},
	onErrorText(data) {

		const { Error } = data;

		// Ex. { "Error": "We could not find the serial port 10 that you were trying to apply the feedrate override to. This error is ok actually because it just means you have not opened the serial port yet." }
		// Ex. { "Error": "You did not specify a port and baud rate in your open cmd" }
		// Ex. { "Error": "Could not understand command." }
		// Ex. { "Error": "Could not parse send command: sendNoBuf" }
		// Ex. { "Error": "We could not find the serial port /dev/ttyAMA0 that you were trying to apply the feedrate override to. This error is ok actually because it just means you have not opened the serial port yet." }

		debug.log(`SPJS -ErrorText-\n  Error: ${Error}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Error' });

		let refMsg = '';

		// If the error message has a colon in it, then it has the origional message in it, use that to find the origional message in the console log.
		if (Error.includes(':')) {

			refMsg = Error.substring(Error.indexOf(':') + 2);
			debug.log(`refMsg: '${refMsg}'`);

			this.consoleLog.updateCmd('SPJS', { Msg: refMsg, Status: 'Error', Comment: 'Syntax Error' });

		// If the message is in response to a non existent port, the message has the port name in it, use that to find the origional message in the console log.
		} else if (Error.includes('serial port') && Error.includes('that you were trying')) {

			let a = Error.indexOf('serial port') + 12;
			let b = Error.indexOf('that you were trying') - 1;

			refMsg = Error.substring(a, b);
			debug.log(`refMsg: '${refMsg}'`);

			this.consoleLog.updateCmd('SPJS', { PartMsg: refMsg, Status: 'Error', Comment: 'Syntax Error' });

		} else {

			// If the verifyMap has anything in it, make the most recent command have a status of error.
			const { verifyMap } = this.consoleLog.SPJS;

			// TODO: Test to make sure this does not error.
			if (verifyMap.length) this.consoleLog.updateCmd('SPJS', { Index: verifyMap[verifyMap.length - 1], IndexMap: verifyMap, Status: 'Error', Comment: 'Syntax Error' });

		}

	},
	onErrorJson(data) {

		const { Cmd } = data;

		debug.log('SPJS -ErrorJson-\n ', data);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Error' });

	},
	onSystemAlarm(data) {

		const { er } = data;

		// Ex. { "er": { "fb": 78.02, "st": 27, "msg": "System alarmed", "val": 1 } }

		const { Label, Desc } = this.lookupStatusCode(er.st);

		debug.log('SPJS -SystemAlarm-\n ', data, `\n  #${er.st} - ${Label}${Desc ? `\n  Desc: ${Desc}` : ''}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Error' });

	},
	lookupStatusCode(code) {
		// Return the label and description of a given status code.
		// Uses the lookup table retreived from the 'TinyG_Status_Codes.cson' file.

		let meta = this.tinygStatusMeta.statusCodes[code];

		// If no meta found for the provided status code, the code is reserved.
		if (!meta) return { Code: code, Label: 'Reserved', Desc: '' };


		let colonIndex = meta.indexOf(':');

		let Label = colonIndex >= 0 ? meta.substring(0, colonIndex) : meta;
		let Desc = colonIndex >= 0 ? meta.substring(colonIndex + 2, meta.length) : '';

		return { Code: code, Label, Desc };

	},
	onFeedRateOverride(data) {

		const { Cmd, Desc, Port, FeedRateOverride, IsOn } = data;

		// Ex. { "Cmd": "FeedRateOverride", "Desc": "Successfully set the feedrate override.", "Port": "COM10", "FeedRateOverride": 3, "IsOn": true }

		debug.log(`SPJS -FeedRateOverride-\n  Desc: ${Desc}\n  Port: ${Port}\n  FeedRateOverride: ${FeedRateOverride}\n  IsOn: ${IsOn}\n  Cmd: ${Cmd}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		this.consoleLog.updateCmd('SPJS', { PartMsg: 'fro ', Status: 'Executed' });

	},
	onRawPortData(data) {

		const { P, D } = data;

		// Ex. { "P": "COM10", "D": "{"r":{"fv":0.970,"fb":78.02,"cv":5,"hp":3,"hv":0,"…"02130215d42","msg":"SYSTEM READY" }, "f": [1,0,0]}\n" }
		// Ex. { "P": "COM10", "D": "[fb]  firmware build             78.02\n" }
		// Ex. { "P": "COM10", "D": "{"r":{"rxm":null},"f":[1,100,9]}\n" }
		// Ex. { "P": "COM10", "D": "{"r":{"ej":1},"f":[1,0,9]}\n" }
		// Ex. { "P": "COM10", "D": "{"r":{"gc":"G0X0"},"f":[1,102,7]}\n" } <- from send text instead of json

		const logMessage = JSON.stringify(data, null, ' ').replace(/\\\"/g, '"').replace(/\t/g, '    ');

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'RawPortData' });

		const port = data.P;
		const safePort = this.makePortSafe(port);

		// If the dataRecvBuffer object for this port is not defined, define it.
		if (typeof this.dataRecvBuffer[safePort] == 'undefined') {
			this.dataRecvBuffer[safePort] = '';
		}

		// Buffer the raw data onto the dataRecvBuffer object.
		this.dataRecvBuffer[safePort] += data.D;

		// If there is at least one full line of raw data in the data buffer and this port is open, parse the data in the raw data buffer.
		if (this.dataRecvBuffer[safePort].match(/\n/) && this.consoleLog.openLogs.includes(safePort)) {
			// debug.log('  ...parsing raw data.');
			this.parseRawPortData(safePort);

		}

	},
	parseRawPortData(port) {
		// This is a seperate method from onRawPortData so that it can be called after this port has been opened if raw data was received before it was opened.

		debug.groupCollapsed(`Parsing raw port data.\n  Port: ${port}`);

		// See if received newline.
		while (/\n/.test(this.dataRecvBuffer[port])) {

			let tokens = this.dataRecvBuffer[port].split('\n');
			// 	let line = tokens.shift() + '\n';
			let line = tokens.shift();
			let lineObj;

			this.dataRecvBuffer[port] = tokens.join('\n');

			line = line.replace(/\t/g, '').replace(/\r/g, '').replace(/\v/g, '').replace(/\f/g, '');

			debug.log(`line character length: ${line.length}\ncharCode: ${line.charCodeAt(0)}`);

			if (line === '') {

				debug.log('This line is an empty string.');

				continue;

			}

			// HACK: Do some last minute cleanup.
			// THIS IS NOT GOOD, BUT SEEING TINYG SHOWING BAD DATA
			// THIS IS ALSO NOT THE RIGHT SPOT SINCE THIS SERIAL PORT WIDGET IS SUPPOSED
			// TO BE GENERIC. Remove when TinyG has no problems.
			if (line.match(/\{"sr"\{"sr"\:/) || line.match(/\{"r"\{"sr"\:/)) {

				// console.warn(`Got corrupted raw port data: '${line}'`);

				line = line.replace(/\{"sr"\{"sr"\:/, '{"sr":');
				line = line.replace(/\{"r"\{"sr"\:/, '{"sr":');

			}

			debug.log(`line: ${line}`);

			// Add the raw data to the respective port's console log.
			this.consoleLog.appendMsg(port, { Msg: line, Type: 'RawPortData' });

			// Try parsing line and if it errors, it is a string. Eitherwise, it is an object that we want information from.
			try {

				lineObj = JSON.parse(line);

			} catch (err) {  // If the line is a text string

				// There was an error parsing line therefore it is a string.
				lineObj = line;

				// If the line was an error message.
				// Ex. "tinyg [mm] err: Unrecognized command or config name: helloworld \n".
				if (/tinyg \[\w{2}\] err:/g.test(line)) {

					debug.log('Got error message.');

					const a = line.indexOf(':', 15) + 2;
					const b = line.length - 1;
					const refMsg = line.substring(a, b);

					debug.log(`RefMsg: '${refMsg}'`);

					const { matchId } = this.consoleLog.updateCmd(port, { Msg: refMsg, Status: 'Error', Comment: 'Syntax Error' });

					if (matchId) {
						this.consoleLog.updateCmd('SPJS', { Id: matchId, Status: 'Error', Comment: 'Syntax Error', UpdateRelated: false });

					} else {
						this.consoleLog.updateCmd('SPJS', { PartMsg: refMsg, Status: 'Error', Comment: 'Syntax Error' });

					}

				// If the device only uses text output (such as the arduino uno).
				} else if (/error: /.test(line)) {

					const { cmdMap } = this.consoleLog[port];

					cmdMap.length && this.consoleLog.updateCmd(port, { Index: cmdMap[cmdMap.length - 1], Status: 'Error', Comment: 'Syntax Error' });

				}

			}

			// debug.log('lineObj:', lineObj);
			console.log('lineObj:', lineObj);

			if (lineObj.sr || (lineObj.r && lineObj.r.sr)) {

				this.consoleLog.updateCmd(port, { Msg: '{sr:n}', Status: 'Executed', UpdateRelated: true });

			}

			if (lineObj.r) {

				// Queue Report.
				if (typeof lineObj.r.qr != 'undefined') {

					// qr

				}

			}

			// Queue Report.
			if (lineObj.qr) {

				// qr

			}

			// Queue In.
			if (lineObj.qi) {

				// qi

			}

			// Queue Out.
			if (lineObj.qo) {

				// qo

			}

			if (lineObj.er) {  // If an error message was received (eg. '{"er":{"fb":78.02,"st":89,"msg":"State management assertion failure",gcs2}}')

				debug.warn('error message found');

				const { fb, st, msg } = lineObj.er;
				const { logBotOnStatusCode } = this.consoleLog;

				let Code;
				let Label;
				let Desc;

				if (typeof st != 'undefined')  // If a status code was received
					({ Code, Label, Desc } = this.lookupStatusCode(st));  // Look up the status code in the status code definitions.

				if (msg)  // If a message was received
					Label = msg;

				const logBotMsg = `${Label} [${this.makePortUnSafe(port)}${typeof matchLine == 'undefined' ? '' : `:${matchLine}`}]`;

				if (logBotOnStatusCode === 'port' || logBotOnStatusCode === 'both')  // If log bot status code messages is enabled in settings
					this.consoleLog.appendMsg(port, { Msg: logBotMsg, IdPrefix: 'bot', Type: 'LogBot' });  // Add a log bot status code message to the port's console log

				if (logBotOnStatusCode === 'spjs' || logBotOnStatusCode === 'both')  // If log bot status code messages is enabled in settings
					this.consoleLog.appendMsg('SPJS', { Msg: logBotMsg, IdPrefix: 'bot', Type: 'LogBot' });  // Add a log bot status code message to the SPJS console log

			}

			// If there is a footer in the data.
			if (lineObj.f) {

				const [ pv, sc, rx ] = lineObj.f;

				debug.log(`Footer:\n  pv: ${pv}\n  sc: ${sc}\n  rx: ${rx}`);

				// If there is a warning or error status code.
				if (sc) {

					debug.log('sc !== 0');

					const { Code, Label, Desc } = this.lookupStatusCode(sc);
					const { logBotOnStatusCode } = this.consoleLog;

					let matchFound = false;
					let matchIndex;
					let matchLine;

					debug.log('lineObj.r:', lineObj.r);
					debug.log(`typeof lineObj.r: ${typeof lineObj.r}`);
					debug.log(`StatusMeta:\n  Code: ${Code}\n  Label: ${Label}\n  Desc: ${Desc}`);

					if (lineObj.r && lineObj.r.err) {  // If the lineObj data was an error message.

						// Ex. { "r": {"err":"{sv}"}, "f": [1,108,4] }.
						const { err: refMsg } = lineObj.r;

						debug.log('Got error data.');
						debug.log(`  RefMsg: '${refMsg}'`);

						let Comment = Code ? Label : 'Syntax Error';

						({ matchFound, matchIndex, matchLine } = this.consoleLog.updateCmd(port, { Msg: refMsg, Status: 'Warning', Comment, UpdateRelated: true }));

						if (!matchFound)
							debug.log('Found no match. idk wtf to do.');

					} else if (typeof lineObj.r === 'string') {

						debug.log(`lineObj.r is a string\n  r: ${lineObj.r}`);

						const { r: refMsg } = lineObj;
						// let Comment = statusMeta.Code ? statusMeta.Label : '';
						// let Comment = statusMeta.Label;

						({ matchFound, matchIndex, matchLine } = this.consoleLog.updateCmd(port, { Msg: refMsg, Status: 'Warning', Comment: `${Label} refMsg`, UpdateRelated: true }));

						// If no matching message was found and there was a footer message, look for a message with a matching length to the rx received by the device.
						if (!matchFound) {

							debug.log('  No matching message was found. Searching for matching message using rx received by the device.');

							// NOTE: This is probably not a good idea cuz it may highlight the incorrect message as having an error since the search criteria is very vague.
							({ matchFound, matchIndex, matchLine } = this.consoleLog.updateCmd(port, { Length: rx, Status: 'Warning', Comment: `${Label} length`, UpdateRelated: true }));

						}

					} else if (typeof lineObj.r === 'object' && Object.keys(lineObj.r).length === 0) {

						debug.log('lineObj.r is an empty object.');

						// ({ matchFound, matchIndex, matchLine } = this.consoleLog.updateCmd(port, { Length: rx, Status: 'Warning', Comment: Label, UpdateRelated: true }));
						({ matchFound, matchIndex, matchLine } = this.consoleLog.updateCmd(port, { Length: rx, Status: 'Warning', Comment: Label, UpdateRelated: true }));

					} else if (typeof lineObj.r === 'object') {

						debug.log('lineObj.r is an object.');

						let rStr = JSON.stringify(lineObj.r);
						let refMsg = rStr.substring(0, rStr.indexOf(':')).replace(/\W/g, '');
						// let refMsg = new RegExp(rStr.substring(0, rStr.indexOf(':')).replace(/\W/, ''), 'gi');

						if (rStr.length > rx) {  // If the parsed string is longer than the string that the port received, replace 'null' with 'n'.

							rStr = rStr.replace(/null/g, 'n');  // Replace 'null' with 'n'
							rStr = rStr.replace(/"/g, '');      // Remove the quotes from the parsed string

						}

						debug.log(`refMsg: ${refMsg}`);

						({ matchFound, matchIndex, matchLine } = this.consoleLog.updateCmd(port, { Msg: rStr, Status: 'Warning', Comment: Label, UpdateRelated: true }));

						matchFound || ({ matchFound, matchIndex, matchLine } = this.consoleLog.updateCmd(port, { PartMsg: refMsg, Length: rx, Status: 'Warning', Comment: Label, UpdateRelated: true }));

						matchFound || ({ matchFound, matchIndex, matchLine } = this.consoleLog.updateCmd(port, { PartMsg: refMsg, Status: 'Warning', Comment: Label, UpdateRelated: true }));

						if (!matchFound)
							debug.log('No match was found for the partMsg and msg length given.');

					} else {

						debug.log('lineObj.r is unrecognized.');

						debug.error('Make lineObj.r recognized and do something with it.');

					}

					const logBotMsg = `${Label} [${this.makePortUnSafe(port)}${typeof matchLine == 'undefined' ? '' : `:${matchLine}`}]`;

					if (logBotOnStatusCode === 'port' || logBotOnStatusCode === 'both')  // If log bot status code messages is enabled in settings
						this.consoleLog.appendMsg(port, { Msg: logBotMsg, IdPrefix: 'bot', Type: 'LogBot' });  // Add a log bot status code message to the port's console log

					if (logBotOnStatusCode === 'spjs' || logBotOnStatusCode === 'both')  // If log bot status code messages is enabled in settings
						this.consoleLog.appendMsg('SPJS', { Msg: logBotMsg, IdPrefix: 'bot', Type: 'LogBot' });  // Add a log bot status code message to the SPJS console log

				}

			}

			publish(`/${this.id}/recvPortData`, port, { Msg: line, Data: lineObj });  // Let the other modules handle the data received.

		}

		debug.groupEnd();

	},
	onQueueCnt(data) {

		const { QCnt } = data;
		const { dataSendBuffer } = this;
		const { queueCount, pauseBufferedSend, userPauseBufferedSend, pauseOnQueueCount, resumeOnQueueCount } = this.SPJS;

		debug.log(`SPJS -QueueCnt-\n  QCnt: ${QCnt}`);

		this.SPJS.queueCount = Number(QCnt);  // Update the queue count
		publish('connection-widget/queue-count', this.SPJS.queueCount);  // Publish the queue count so that other widgets can use it

		if (queueCount < pauseOnQueueCount && !pauseBufferedSend) {  // If there are few commands in the queue, send commands.


		} else if (queueCount > pauseOnQueueCount && !pauseBufferedSend) {  // If there are too many commands in the queue, pause sending commands to the SPJS.

			this.SPJS.pauseBufferedSend = true;				 // Pause buffering data to the SPJS
			publish('gcode-buffer/control', 'auto-paused');

		} else if (queueCount < resumeOnQueueCount) {  // If there are few commands in the queue, resume sending commands to the SPJS.

			this.SPJS.pauseBufferedSend = false;			  // Resume buffering data to the SPJS
			publish('gcode-buffer/control', 'auto-resumed');

		}

		this.checkSendBufferEmpty();

		if (!this.SPJS.pauseBufferedSend && !userPauseBufferedSend && !this.dataSendBufferEmpty) {  // If the buffer process can be run

			this.sendBuffered();  // Try buffering data to the SPJS

		}

	},
	onCayenn(data) {

		const { Addr, Announce, Widget, JsonTag, DeviceId } = data;

		debug.log(`SPJS -Cayenn-\n  Addr: ${JSON.stringify(Addr)}\n  Announce: ${Announce}\n  Widget: ${Widget}\n  JsonTag: ${JsonTag}\n  DeviceId: ${DeviceId}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Cayenn' });

		this.consoleLog.updateCmd('SPJS', { PartMsg: 'cayenn-sendudp', Status: 'Executed' });

	},
	onGarbageCollection(data) {

		const { gc } = data;

		const statusMeta = {
			starting: 'Written',
			done: 'Completed'
		};

		debug.log(`SPJS -GarbageCollection-\n  Status: ${gc}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'GarbageCollection' });

		this.consoleLog.updateCmd('SPJS', { Msg: 'gc', Status: statusMeta[gc] });

	},
	onGarbageHeap(data) {

		const { Alloc, TotalAlloc, Sys, Lookups, Mallocs, Frees, HeapAlloc, HeapSys, HeapIdle, HeapInuse, HeapReleased, HeapObjects, StackInuse, StackSys, MSpanInuse, MSpanSys, MCacheInuse, MCacheSys, BuckHashSys, GCSys, OtherSys, NextGC, LastGC, PauseTotalNS, PauseNS, PauseEnd, NumGC, GCCPUFraction, EnableGC, DebugGC, BySize } = data;

		debug.log('SPJS -GarbageCollectionHeap-');

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'GarbageHeap' });

		debug.log(`GCCPUFraction: ${(GCCPUFraction * 100).toFixed(10)}%`);

	},
	onExecRuntimeStatus(data) {

		const { ExecRuntimeStatus, OS, Arch, Goroot, NumCpu } = data;

		const statusMeta = {
			Done: 'Executed'
		};

		// The ExecRuntimeStatus message is a result of calling the 'execruntime' command.
		// Ex. { "ExecRuntimeStatus": "Done", "OS": "windows", "Arch": "amd64", "Goroot": "/usr/local/go", "NumCpu": 4 }

		debug.log('SPJS -ExecRuntimeStatus-');

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'ExecRuntimeStatus' });

		this.consoleLog.updateCmd('SPJS', { Msg: 'execruntime', Status: statusMeta[ExecRuntimeStatus] });

	},
	onExecStatus(data) {

		const { ExecStatus, Id, Cmd, Args, Output } = data;

		const statusMeta = {
			Progress: 'Written',
			Done: 'Executed',
			Error: 'Error'
		};

		// Ex. { "ExecStatus": "Error", "Id": "", "Cmd": "C:\\WINDOWS\\system32\\cmd.exe", "Args": [ "cd thermika" ], "Output": "Error trying to execute terminal command. No user/pass provided or command line switch was not specified to allow exec command. Provide a valied username/password or restart spjs with -allowexec command line option to exec command." }
		// Ex. { "ExecStatus": "Progress", "Id": "", "Cmd": "C:\\WINDOWS\\system32\\cmd.exe", "Args": [ "echo HelloWorld" ], "Output": "HelloWorld" }
		// Ex. { "ExecStatus": "Done", "Id": "", "Cmd": "C:\\WINDOWS\\system32\\cmd.exe", "Args": [ "echo HelloWorld" ], "Output": "HelloWorld" }

		debug.log('SPJS -ExecStatus-');

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'ExecStatus' });

		let Comment = '';

		if (ExecStatus === 'Error' && Output.includes('No user/pass provided')) {

			Comment = 'Permission Denied';

		} else if (ExecStatus === 'Error') {

			Comment = 'Failed';

		}

		let Msg = 'exec';

		for (let i = 0; i < Args.length; i++) {

			Msg += ` ${Args[i]}`;

		}

		this.consoleLog.updateCmd('SPJS', { Msg, Status: statusMeta[ExecStatus], Comment });

	},
	onParseError(data) {

		// Ex. { "Error" : "Problem decoding json. giving up. json: {"P":"COM11","Data":[{"D":"Hi ","Id":"mdi-com11log0"}]}, err:invalid character '\n' in string literal" }

		debug.groupCollapsed(`SPJS -ParseError-\n  Error: ${Error}`);

		if (data.includes('Problem decoding json. giving up. json: ') && data.includes(', err:')) {

			const a = data.indexOf('json: ') + 6;
			const b = data.indexOf(', err:');

			const refMsg = data.substring(a, b);

			debug.log(`refMsg: ${refMsg}`);

			let { matchFound } = this.consoleLog.updateCmd('SPJS', { PartMsg: refMsg, Status: 'Error', Comment: 'JSON Error' });

			// If no match was found, try to parse the Id from the error message so that it can be used to try and find the responsible message in the log.
			if (!matchFound && data.includes('"Id":"') && (/\"[\}\]]+,/).test(data)) {

				debug.log('Match not found.\nTrying to get Id from error report.');

				const c = data.indexOf('"Id":"') + 6;
				const d = data.indexOf(data.match(/\"[\}\]]+,/)[0]);
				const refId = data.substring(c, d);

				debug.log(`refId: ${refId}`);

				({ matchFound } = this.consoleLog.updateCmd('SPJS', { Id: refId, Status: 'Error', Comment: 'JSON Error' }));

			}

			// If no match was found, try to parse the Id from the error message (again but in a slightly different way) so that it can be used to try and find the responsible message in the log.
			if (!matchFound && data.includes('"Id":"')) {

				const c = data.indexOf('"Id":"') + 6;
				let d = 0;

				for (let i = c; i < data.length; i++) {

					if (data[i] === '"') {

						d = i;

						break;

					}

				}

				// If a valid range was found, try finding a command with a matching Id.
				if (d > c) {

					const refId = data.substring(c, d);

					debug.log(`refId: ${refId}`);

					this.consoleLog.updateCmd('SPJS', { Id: refId, Status: 'Error', Comment: 'JSON Error' });

				}

			}

		}

		debug.groupEnd();

	},
	makePortSafe(unsafePortName) {
		// The linux platform gives port names like 'dev/ttyAMA0' which messes up the object names and the dom operations.

		const portList = this.SPJS.portList;

		let safePortName = unsafePortName ? unsafePortName.replace(/^\//g, 'fs-').replace(/\//g, '-fs-') : unsafePortName;

		// If the port is not in the portList object, try to find a match.
		if (safePortName && !portList[safePortName]) {
			// debug.log(`The safePortName: '${safePortName}' not found in the serial ports list.`);

			// Loop through each port in the portList object.
			for (let port in portList) {

				// If the ports match case-insensitive.
				if (port.toLowerCase() === safePortName.toLowerCase()) {

					safePortName = port;
					// debug.log(`The safePortName: '${safePortName}' not found in the serial ports list.\nChanged safePortName to: '${safePortName}'.`);

					break;

				}

			}

		}

		return safePortName;

	},
	makePortUnSafe(safePortName) {
		// The linux platform gives port names like 'dev/ttyAMA0' which messes up the object names and the dom operations.

		let unsafePortName = safePortName ? safePortName.replace(/fs-|-fs-/g, '/') : safePortName;

		return unsafePortName;

	},

	gcodeBufferControl(data) {

		debug.log(`got control data: '${data}'`);

		if (data === 'pause') {  // User pressed pause button

			this.SPJS.userPauseBufferedSend = true;  // Pause buffering data to the SPJS
			publish('gcode-buffer/control', 'user-paused');

		} else if (data === 'resume') {  // User pressed resume button

			this.SPJS.userPauseBufferedSend = false;  // Resume buffering data to the SPJS
			publish('gcode-buffer/control', 'user-resumed');

		} else if (data === 'stop') {  // User pressed stop button

			const { dataSendBuffer } = this;
			const { openPorts, sendFeedholdOnBufferStop, waitQueueFlushOnFeedstop, waitCycleResumeOnFeedstop } = this.SPJS;

			this.SPJS.userPauseBufferedSend = false;
			Object.keys(dataSendBuffer).forEach(key => (this.dataSendBuffer[key] = []));  // Clear all buffered data for each port
			this.dataSendBufferEmpty = true;  // Set the buffer empty flag

			if (sendFeedholdOnBufferStop) {

				for (let i = 0; i < openPorts; i++) {  // For each open port

					this.portFeedstop(openPorts[i]);  // Send feedstop to all ports

					setTimeout(() => {

						this.newportSendJson(openPorts[i], { Msg: '~' });  // Send resume cycle command

					}, waitQueueFlushOnFeedstop + waitCycleResumeOnFeedstop);

				}
			}

		}

	},
	portSendBuffered(port, { Data, Msg, Id, IdPrefix, Pause = 0, Type = 'Command', Status, Comment, Meta = [] }) {

		debug.groupCollapsed('portSendBuffered');

		// If the Meta argument is not an array, split it into an array.
		if (!Array.isArray(Meta)) {

			console.error(`The Meta argument is not an array. But i will fix it for you... because i am nice like that. Next time i may not be so nice, so you may wanna get that fixed.\n  Meta: ${Meta}\n  typeof: ${typeof Meta}`);

			Meta = Meta.split(' ');

		}

		const { queueCount, pauseBufferedSend, userPauseBufferedSend } = this.SPJS;
		let cmdBuffer = [];
		let idBase;
		let idSuffix;

		if (typeof port == 'undefined')
			debug.error('The port argument was not passed properly.');

		if (typeof Data == 'undefined' && typeof Msg != 'undefined')  // Msg argument can be used instead of Data argument to pass a single command
			Data = Msg;

		if (typeof Id == 'undefined' && typeof IdPrefix == 'undefined') {

			idBase = 'gc';
			idSuffix = '0';

		}

		// The data argument is [array[]], parse the data from it.
		if (Array.isArray(Data)) {

			if (Id) {

				idBase = Id.substring(0, Id.search(/[0-9]+\b/));
				idSuffix = /[0-9]+\b/.exec(Id);

				if (!idSuffix)
					idSuffix = '0';

				debug.log(`idBase: ${idBase}\nidSuffix: ${idSuffix}`);

			}

			for (let i = 0; i < Data.length; i++) {

				cmdBuffer.push({ Msg: Data[i], Id, IdPrefix, Pause, Status, Comment, Meta: i < Data.length - 1 ? [ 'portSendJson' ].concat(`${i + 1}of${Data.length}`, Meta) : [ 'portSendJson' ].concat(`${i + 1}of${Data.length}`, 'final', Meta) });

				let item = cmdBuffer[i];

				// The Data argument is [array[object[string/int]]].
				// Eg. Data: [ { Msg:msg0, Id:id0 }, { Msg:msg1, Id:id1 }, ..., { Msg:msgn, Id:idn } ]
				// Eg. Data: [ { Msg:msg0, Id:id0, Pause:pause0 }, { Msg:msg1, Id:id1, Pause:pause1 }, ..., { Msg:msgn, Id:idn, Pause:pausen } ]
				if (typeof Data[i] === 'object') {

					debug.log('Data argument is [array[object[string/int]]]');
					// Parse item msg.
					item.Msg = Data[i].Msg;

					// Parse item id.
					if (Data[i].Id) {

						item.Id = Data[i].Id;

					} else if (Id) {

						const idItemSuffix = (Number(idSuffix) + i).toString();
						const idDeltaLen = idSuffix.length - idItemSuffix.length;
						const idItemZeros = idDeltaLen > 0 ? idDeltaLen : 0;

						item.Id = `${idBase}${'0'.repeat(idItemZeros)}${idItemSuffix}`;

						debug.log(`i: ${i}\n  idItemSuffix: ${idItemSuffix}\n  idDeltaLen: ${idDeltaLen}\n  idItemZeros: ${idItemZeros}\n  id: ${item.Id}`);

					}

					item.Pause = typeof Data[i].Pause !== 'undefined' ? Data[i].Pause : Pause;
					item.Status = typeof Data[i].Status !== 'undefined' ? Data[i].Status : Status;
					item.Comment = typeof Data[i].Comment !== 'undefined' ? Data[i].Comment : Comment;
					// item.Related = Data[i].Related !== undefined ? Data[i].Related : Related;
					item.Meta = typeof Data[i].Meta !== 'undefined' ? Data[i].Meta : Meta;

				} else if (typeof Data[i] === 'string') {  // If the Data argument is [array[string]] (eg. Data: [ msg0, msg1, ..., msgn ], Id: id0, Pause: pause0).

					debug.log('Data argument is [array[string/int]]');

					let idItemSuffix = (Number(idSuffix) + i).toString();
					let idDeltaLen = idSuffix.length - idItemSuffix.length;
					let idItemZeros = idDeltaLen > 0 ? idDeltaLen : 0;

					if (/^N[0-9]+/i.test(Data[i])) {  // If the message contains a line number

						const [ gcLineNumber ] = Data[i].match(/^N[0-9]+/i);
						item.Id = `${idBase}${gcLineNumber}`;

					} else {  // If the message doe not contain line number

						item.Id = `${idBase}${'0'.repeat(idItemZeros)}${idItemSuffix}`;

					}

					debug.log(`i: ${i}\n  idItemSuffix: ${idItemSuffix}\n  idDeltaLen: ${idDeltaLen}\n  idItemZeros: ${idItemZeros}\n  id: ${item.Id}`);

				}

			}

		} else if (typeof Data == 'string') {  // If Data is a single command (eg. Data: 'helloworld', Id: 'testId')

			debug.log('Data argument is a string.');

			cmdBuffer.push({ Msg: Data, Id, IdPrefix, Pause, Status, Comment, Meta: [ 'portSendJson', '1of1' ] });

			debug.log('cmdBuffer:', cmdBuffer);

		} else {  // If the Data argument is invalid

			debug.error('Did not receive a valid Data argument.\n  Data:', Data);

		}

		debug.groupEnd();

		// this.dataSendBuffer[port].concat(cmdBuffer);  // Add the new messages to the end of the buffer
		this.dataSendBuffer[port] = [ ...this.dataSendBuffer[port], ...cmdBuffer ];  // Add the new messages to the end of the buffer

		this.checkSendBufferEmpty();

		if (!pauseBufferedSend && !userPauseBufferedSend && !this.dataSendBufferEmpty)
			this.sendBuffered();  // Buffer lines to the SPJS

	},
	checkSendBufferEmpty() {

		const { dataSendBuffer } = this;
		const { openPorts } = this.SPJS;
		let keys = [];

		for (let i = 0; i < openPorts.length; i++) {

			const port = openPorts[i];

			if (dataSendBuffer[port] && dataSendBuffer[port].length) {  // If the send buffer has data in it

				this.dataSendBufferEmpty = false;
				keys.push(port);

			} else {  // If the send buffer is empty

				this.dataSendBufferEmpty = false;

			}

		}

		// Object.keys(dataSendBuffer).forEach((key, value) => {  // Check if there is still buffered data to be sent
		//
		// 	if (value.length) {  // If there is buffered data in the port's send buffer
		//
		// 		this.dataSendBufferEmpty = false;
		// 		keys.push(key);
		//
		// 	}
		//
		// }, this.checkSendBufferEmpty);

		if (!keys.length) this.dataSendBufferEmpty = true;

		return keys;  // Return a list of ports with data in their send buffer

	},
	sendBuffered() {

		const { dataSendBuffer } = this;
		const { queueCount, pauseBufferedSend, userPauseBufferedSend, maxLinesAtATime, minWaitBetweenBufferSend, lastBufferSendTime } = this.SPJS;

		if (lastBufferSendTime && Date.now() - lastBufferSendTime < minWaitBetweenBufferSend) return;
		this.SPJS.lastBufferSendTime = Date.now();

		if (pauseBufferedSend || userPauseBufferedSend) return false;  // If sending buffered data is paused

		const bufferPorts = this.checkSendBufferEmpty();  // Get a list of ports with data in their send buffer

		for (let i = 0; i < bufferPorts.length; i++) {

			const port = bufferPorts[i];
			const buffer = dataSendBuffer[port];

			this.newportSendJson(port, { Data: buffer.splice(0, maxLinesAtATime) });  // Send lines from buffer to the ports on the SPJS

		}

		this.checkSendBufferEmpty();  // Update the buffer empty flag

		return bufferPorts.length > 0;

	},

	portFeedstop(port) {

		const { portMeta, openPorts, waitQueueFlushOnFeedstop, waitCycleResumeOnFeedstop } = this.SPJS;

		if (!openPorts || typeof openPorts[port] === 'undefined')  // If the port argument is invalid
			debug.error(`The port argument passed to the portFeedstop method is not valid.\n  port: '${port}'`);

		// this.newportSendNoBuf(port, { Msg: '!' });  // Send feedhold command
		this.newportSendJson(port, { Msg: '!\n' });

		setTimeout(() => {

			// this.newportSendNoBuf(port, { Msg: '%' });  //Send queue flush command
			this.newportSendJson(port, { Msg: '%\n' });

		}, waitQueueFlushOnFeedstop);

		// setTimeout(() => {
		//
		// 	// Cycle Resume.
		// 	this.newportSendJson(port, { Msg: '~' });
		//
		// }, waitQueueFlushOnFeedstop + waitCycleResumeOnFeedstop);

	},

	/**
	 *  Sends messages to the SPJS.
	 *
	 *  @method newspjsSend
	 *
	 *  @param  {string}    Msg               The message that is to be sent to the SPJS.
	 *  @param  {string}    Id                (opt) The unique identifier that will be attached to this message in the console log.
	 *  @param  {string}    IdPrefix          (opt) If Id is omitted but IdPrefix is provided, a new identifier based on the IdPrefix, port, and line number will be created.
	 *  @param  {string}    [Type='Command']  (opt) The type of message that is to be sent. (eg. 'Command' or 'MdiCommand')
	 *  @param  {string}    Status            (opt) The status of the message when it is added to the console log.
	 *  @param  {string}    Comment           (opt) The comment that will be displayed beside the message in the console log.
	 *  @param  {object}    Related           [description]
	 *  @param  {Array}     [Meta=[]]         [description]
	 *  @param  {number}    [recursionDepth=0]              Counter used internally by this method to keep track of recursion depth to prevent infinite looping.
	 *
	 *  @return {string}    cmdId             The id that was used for the message in the console log.
	 */
	newspjsSend({ Msg, Id, IdPrefix, Type = 'Command', Status, Comment, Related, Meta = [], recursionDepth = 0 }) {

		debug.log(`SPJS Send\n  Msg: ${Msg}`);

		// If the Meta argument is not an array, split it into an array.
		if (!Array.isArray(Meta)) {

			console.error(`The Meta argument is not an array. But i will fix it for you... because i am nice like that. Next time i may not be so nice, so you may wanna get that fixed.\n  Meta: ${Meta}\n  typeof: ${typeof Meta}`);

			Meta = Meta.split(' ');

		}

		// If the SPJS is not open, abort sending the command.
		if (this.SPJS.wsState !== 'open') {

			debug.log('The SPJS is not open.');

			Comment = Comment ? `${Comment}] [SPJS Closed` : 'SPJS Closed';

			const { cmdId } = this.consoleLog.appendMsg('SPJS', { Msg, Id, IdPrefix, Type, Status: 'Error', Comment, Related, Meta });

			return false;

		}

		const { staleListCmdLimit, findStaleCommands } = this.consoleLog;

		// If the Msg argument is 'list' and the SPJS is already processing a 'list' command, exit this method.
		if (Msg === 'list') {

			const { matchFound, matchIndex, matchTime } = this.consoleLog.findItem('SPJS', { Msg: 'list', IndexMap: this.consoleLog.SPJS.verifyMap });
			const deltaTime = matchFound && Date.now() - matchTime;

			// debug.log(`matchFound: ${matchFound}\nmatchTime: ${matchTime}\ndeltaTime: ${deltaTime}\nstaleListCmdLimit: ${this.consoleLog.staleListCmdLimit}`);

			// If a 'list' command was found in the log and it is older than staleListCmdLimit, flag that command as Error and try sending the list command again.
			if (matchFound && Date.now() - matchTime > staleListCmdLimit) {

				debug.log('Found stale list command.');

				this.consoleLog.updateCmd('SPJS', { Index: matchIndex, Status: 'Error', Comment: 'Stale' });

				if (recursionDepth >= 15) {  // Limit the number of recursion events to prevent infinite loop.

					debug.error('The newspjsSend method may be stuck in an infinite loop trying to send a \'list\' command.');
					return false;

				}

				// Try sending the list command again as there may me multiple pending list commands in the SPJS that may or may not be stale.
				recursionDepth += 1;

				return setTimeout(() => this.newspjsSend({ Msg: 'list', Comment, Related, Meta, recursionDepth }), 1000);

			// If a 'list' comand was found that is not stale, do not send a new 'list' command.
			} else if (matchFound) {

				debug.log('The SPJS is already processing a request for the portList.\nRequest for list terminated.');

				return false;

			}

		}

		// Add the command to the SPJS console log.
		const { cmdId } = this.consoleLog.appendMsg('SPJS', { Msg, Id, IdPrefix, Type, Status, Comment, Related, Meta });

		// Send the command to the SPJS. There may be an error following the send if the web socket has just closed.
		try {
			this.SPJS.ws.send(Msg);

		// Since there was an error sending the command, show the error in the log and return false.
		} catch (err) {

			debug.log(`Could not send command to the SPJS.\nError: ${err}`);

			this.consoleLog.updateCmd('SPJS', { Id: cmdId, Status: 'Error', Comment: 'SPJS Closed' });

			return false;

		}

		// Return the command id to indicate that the command was sent successfully.
		return { cmdId };

	},
	newportSend(port, { Msg, IdPrefix, Type = 'Command', Status, Comment, Meta = [] }) {

		// If the Meta argument is not an array, split it into an array.
		if (!Array.isArray(Meta)) {
			console.error(`The Meta argument is not an array. But i will fix it for you... because i am nice like that. Next time i may not be so nice, so you may wanna get that fixed.\n  Meta: ${Meta}\n  typeof: ${typeof Meta}`);
			Meta = Meta.split(' ');
		}

		Meta.push('portSend');

		// Append the command to this port's log and use the returned id as the id for the SPJS log as well.
		// If the id argument was omitted, the appendMsg method will make one up.
		const { cmdId } = this.consoleLog.appendMsg(port, { Msg, IdPrefix, Type, Status, Comment, Meta });

		const unsafePort = this.makePortUnSafe(port);
		const cmd = `send ${unsafePort} ${Msg}`;

		// Send the message to the SPJS. If there is an error sending the command to the SPJS, the status of the message in the port's log will be automatically changed.
		if (!this.newspjsSend({ Msg: cmd, Id: cmdId, Status, Comment, Related: port, Meta })) return false;

		// Return true to indicate that the command was sent successfully.
		return cmdId;

	},
	newportSendNoBuf(port, { Msg, IdPrefix, Type = 'Command', Status, Comment, Meta = [] }) {
		// To reset tinyg board, send it a '\u0018\n' command.

		// If the Meta argument is not an array, split it into an array.
		if (!Array.isArray(Meta)) {

			console.error(`The Meta argument is not an array. But i will fix it for you... because i am nice like that. Next time i may not be so nice, so you may wanna get that fixed.\n  Meta: ${Meta}\n  typeof: ${typeof Meta}`);

			Meta = Meta.split(' ');

		}

		Meta.push('portSendNoBuf');

		// Append the command to this port's log and use the returned id as the id for the SPJS log as well.
		// If the id argument was omitted, the appendMsg method will make one up.
		const { cmdId } = this.consoleLog.appendMsg(port, { Msg, IdPrefix, Type, Status, Comment, Meta });

		const unsafePort = this.makePortUnSafe(port);
		const cmd = `sendnobuf ${unsafePort} ${Msg}`;

		let Related = {
			Port: port,
			Id: cmdId
		};

		// Send the message to the SPJS. If there is an error sending the command to the SPJS, the status of the message in the port's log will be automatically changed.
		if (!this.newspjsSend({ Msg: cmd, Id: cmdId, Status, Comment, Related, Meta })) return false;

		// Return true to indicate that the command was sent successfully.
		return true;

	},
	newportSendJson(port, { Data, Msg, Id, IdPrefix, Pause = 0, Type = 'Command', Status, Comment, Meta = [] }) {
		// This method sends JSON messages to specified ports on the SPJS.
		// Ex. portSendJson [port] [cmd] [id]
		// Ex. portSendJson [port] [ [cmd], [cmd1], ..., [cmdn] ] [id]
		// Ex. portSendJson [port] [ [[cmd],[id]], [[cmd1],[id1]], ..., [[cmdn],[idn]] ]
		// Sends message as: 'sendjson { "P":"[port]", "D": {[ "Data": "[cmd]", "Id": "[id]-0" ], [ "Data": "[cmdn]", "Id": "[id]-1" ]} }'
		// If the id ends in a number, the following id's will be increments of that number. Otherwise add '-0', '-1', '-2', ... '-n' to the end of each id (ie. 'init-0').
		// An Id must be passed to this method either in each Data array element or the Id argument.
		// Arg. Data [string] or [arrray[string]] [array[array[string/int]]] - If only sending one command, the id and pause values must be passed into their respective arguments and not in the form of [array[string/int]] as the parser will read that as an array of commands.
		// 	 The Data argument can also take Status, Comment, and Meta arguments.
		// 	 Ex. Data: [ [msg0,(id0),(pause0)], [msg1,(id1),(pause1)], ..., [msgn,(idn),(pausen)] ]
		//   Ex. Data: [ { Msg:msg0, Id:id0 }, { Msg:msg1, Id:id1 }, ..., { Msg:msgn, Id:idn } ]
		//   Ex. Data: [ { Msg:msg0, Id:id0, Pause:pause0 }, { Msg:msg1, Id:id1, Pause:pause1 }, ..., { Msg:msgn, Id:idn, Pause:pausen } ]
		// Arg. Msg [string] - Can be used instead of Data for single line commands.
		// Arg. Id [string] - If there are multiple msgs and the id ends with a number, the number will be incremented automatically for each msg. Otherwise, a suffix (ie. '-0', '-1', '-2', ... '-n') will be added to the end of each id.

		debug.groupCollapsed('newportSendJson');

		// If the Meta argument is not an array, split it into an array.
		if (!Array.isArray(Meta)) {

			console.error(`The Meta argument is not an array. But i will fix it for you... because i am nice like that. Next time i may not be so nice, so you may wanna get that fixed.\n  Meta: ${Meta}\n  typeof: ${typeof Meta}`);

			Meta = Meta.split(' ');

		}

		const { portMeta } = this.SPJS;

		let cmdBuffer = [];
		let idBase;
		let idSuffix;

		if (typeof port == 'undefined')
			debug.error('The port argument was not passed properly.');

		if (typeof Data == 'undefined' && typeof Msg != 'undefined')  // Msg argument can be used instead of Data argument to pass a single command
			Data = Msg;

		if (Array.isArray(Data)) {  // The data argument is [array[]]

			if (Id) {

				idBase = Id.substring(0, Id.search(/\d+\b/));
				idSuffix = /\d+\b/.exec();

				if (!idSuffix)
					idSuffix = '0';

				debug.log(`idBase: ${idBase}\nidSuffix: ${idSuffix}`);

			} else {

				idBase = ''
				idSuffix = '';

			}

			for (let i = 0; i < Data.length; i++) {

				cmdBuffer.push({ Msg: Data[i], Id, IdPrefix, Pause, Status, Comment, Meta: i < Data.length - 1 ? [ 'portSendJson' ].concat(`${i + 1}of${Data.length}`, Meta) : [ 'portSendJson' ].concat(`${i + 1}of${Data.length}`, 'final', Meta) });

				let item = cmdBuffer[i];

				// The Data argument is [array[object[string/int]]].
				// Eg. Data: [ { Msg:msg0, Id:id0 }, { Msg:msg1, Id:id1 }, ..., { Msg:msgn, Id:idn } ]
				// Eg. Data: [ { Msg:msg0, Id:id0, Pause:pause0 }, { Msg:msg1, Id:id1, Pause:pause1 }, ..., { Msg:msgn, Id:idn, Pause:pausen } ]
				if (typeof Data[i] == 'object') {

					debug.log('Data argument is [array[object[string/int]]]');
					// Parse item msg.
					item.Msg = Data[i].Msg;

					// Parse item id.
					if (Data[i].Id) {

						item.Id = Data[i].Id;

					} else if (Id) {

						const idItemSuffix = (Number(idSuffix) + i).toString();
						const idDeltaLen = idSuffix.length - idItemSuffix.length;
						const idItemZeros = idDeltaLen > 0 ? idDeltaLen : 0;

						item.Id = `${idBase}${'0'.repeat(idItemZeros)}${idItemSuffix}`;

						debug.log(`i: ${i}\n  idItemSuffix: ${idItemSuffix}\n  idDeltaLen: ${idDeltaLen}\n  idItemZeros: ${idItemZeros}\n  id: ${item.Id}`);

					}

					item.Pause = typeof Data[i].Pause != 'undefined' ? Data[i].Pause : Pause;
					item.Status = typeof Data[i].Status != 'undefined' ? Data[i].Status : Status;
					item.Comment = typeof Data[i].Comment != 'undefined' ? Data[i].Comment : Comment;
					// item.Related = Data[i].Related !== undefined ? Data[i].Related : Related;
					item.Meta = typeof Data[i].Meta != 'undefined' ? Data[i].Meta : Meta;

				// The Data argument is [array[string]].
				// Eg. Data: [ msg0, msg1, ..., msgn ], Id: id0, Pause: pause0
				} else if (typeof Data[i] === 'string') {

					debug.log('Data argument is [array[string/int]]');

					let idItemSuffix = (Number(idSuffix) + i).toString();
					let idDeltaLen = idSuffix.length - idItemSuffix.length;
					let idItemZeros = idDeltaLen > 0 ? idDeltaLen : 0;

					item.Id = `${idBase}${'0'.repeat(idItemZeros)}${idItemSuffix}`;
					debug.log(`i: ${i}\n  idItemSuffix: ${idItemSuffix}\n  idDeltaLen: ${idDeltaLen}\n  idItemZeros: ${idItemZeros}\n  id: ${item.Id}`);

				}
				// cmdBuffer[i].Meta.push('portSendJson', `${ i + 1 }of${Data.length}`);

			}

		// Data is a single command.
		// Eg. Data: msg, Id: id, ...etc.
		} else if (typeof Data == 'string') {

			debug.log('Data argument is a string.');
			// console.error('Id argument was omitted.\n  Id:', Id);

			cmdBuffer.push({ Msg: Data, Id, IdPrefix, Pause, Status, Comment, Meta: [ 'portSendJson', '1of1' ] });

			debug.log('cmdBuffer:', cmdBuffer);

		} else {

			console.error('Did not receive a valid Data argument.\n  Data:', Data);

		}

		// Send the commands as buffered.
		// this.portSendBuffered(port, { Data: cmdBuffer });

		// let cmd = this.unparseComands(port, { Data: bufferItem });

		const unsafePort = this.makePortUnSafe(port);
		let cmd = `sendjson {"P":"${unsafePort}","Data":[`;
		let cmdIds = [];

		// Build the command string.
		for (let i = 0; i < cmdBuffer.length; i++) {

			let bufferItem = cmdBuffer[i];

			// Append the command to this port's log and use the returned id as the id for the SPJS log as well.
			// If the id argument was omitted, the appendMsg method will make one up based on the port and line number.
			const { cmdId } = this.consoleLog.appendMsg(port, { Msg: bufferItem.Msg, Id: bufferItem.Id, IdPrefix: bufferItem.IdPrefix, Type, Status: bufferItem.Status, Comment: bufferItem.Comment, Related: bufferItem.Related, Meta: bufferItem.Meta });

			cmdIds.push(cmdId);

			// Do not add a linefeed character to a reset or feedhold command.
			if (!(/\\n$/).test(bufferItem.Msg) && !(/[%!]/).test(bufferItem.Msg)) {
				// bufferItem.Msg += '\\n';
				bufferItem.Msg += portMeta[port].lineEnding;

			}

			cmd += i ? ',' : '';
			cmd += `{"D":"${bufferItem.Msg}","Id":"${cmdIds[i]}"${bufferItem.Pause ? `,"Pause":${bufferItem.Pause}` : ''}}`;

		}

		cmd += ']}';

		let spjsId = cmdBuffer.length > 1 ? cmdIds[cmdIds.length - 1] : cmdIds[0];

		// Send the message to the SPJS. If there is an error sending the command to the SPJS, the status of the message in the port's log will be automatically changed.
		if (!this.newspjsSend({ Msg: cmd, Id: spjsId, Status, Comment, Related: { Port: port, Id: cmdIds }, Meta: [ 'portSendJson' ] })) {

			debug.groupEnd();

			return false;

		}

		debug.groupEnd();

		// Return true to indicate that the command was sent successfully.
		return spjsId;

	},
	mdiSend(port, { Msg }) {
		// Send a command comming from a MDI (Manual Data Input) from the user.

		const that = this;
		const portList = this.SPJS.portList;

		// If there is space before the message, remove it.
		Msg = /^\s+\S/.test(Msg) ? Msg.replace(/^\s+/, '') : Msg;

		// If sending to the SPJS port, correct any character upper/lower case mistakes for port names.
		// Nothing should break if port is not entered with correct cases but it is just allot better.
		// Ex. 'close com4' is changed to 'close COM4'.
		if (port === 'SPJS') {

			for (let portName in portList) {

				let unsafePortName = this.makePortUnSafe(portName);

				let refStr = new RegExp(unsafePortName, 'gi');
				// debug.log('refStr:', refStr);

				Msg = Msg.replace(refStr, unsafePortName);

			}

			// If the message is related to a specific port, put the message in the port's log.
			// If the message is not a 'sendnobuf' command, check if it relates to a port so it can be added to the port's console log.
			// TODO: Make this work for sendjson messages as well.
			if (Msg.includes('sendnobuf')) {

				// Ex. Msg: 'sendnobuf COM5 helloworld'
				let [ msgOperation, msgPort, ...msg ] = Msg.split(' ');
				msg = msg.join(' ');

				debug.log('msgOperation:', msgOperation, '\nmsgPort:', msgPort, '\nmsg:', msg, `\nmsg: '${msg}'`);

				const safeMsgPort = msgPort ? this.makePortSafe(msgPort) : undefined;

				// Send the message to the SPJS.
				const { cmdId } = this.newspjsSend({ Msg, IdPrefix: 'mdi', Type: 'MdiCommand', Related: safeMsgPort });

				// Add the command to the respective port's log with the same id as the message in the SPJS log.
				if (cmdId && msg && safeMsgPort && this.consoleLog.openLogs.includes(safeMsgPort)) {

					this.consoleLog.appendMsg(safeMsgPort, { Msg: msg, Id: cmdId, Type: 'MdiCommand', Meta: [ 'portSendNoBuf' ], Status: 'Sent' });

					debug.log('Added message to related port.');

					// NOTE: The following are intended for debugging purposes only.
				} else {

					cmdId || debug.log('!cmdId', cmdId);
					msg || debug.log('!msg', msg);
					safeMsgPort || debug.log('!safeMsgPort', safeMsgPort);

					this.consoleLog.openLogs.includes(safeMsgPort) || debug.log('!this.consoleLog.openLogs.includes(safeMsgPort)', this.consoleLog.openLogs.includes(safeMsgPort));

				}

				// If the message is not a 'sendnobuf' command.
			} else {

				this.newspjsSend({ Msg, IdPrefix: 'mdi', Type: 'MdiCommand' });

			}

			// If a message contains only characters like '!' or '%', send to device without buffering.
		} else if (/\W/.test(Msg) && !/ |\w|\?/.test(Msg)) {

			this.newportSendNoBuf(port, { Msg, IdPrefix: 'mdi', Type: 'MdiCommand' });

		} else {
			this.newportSendJson(port, { Msg, IdPrefix: 'mdi', Type: 'MdiCommand' });

		}

	},

	// FIXME: Fix how input values are taken... cuz its shit atm.
	// FIXME: When the active log changes, scroll to the bottom of that log if it was previously scrolled to the bottom.
	// FIXME: Do not allow SPJS commands to be sent from the input field if not connected to a SPJS.
	consoleLogGetInputValue(logName) {
		// If the logName argument is omitted, the input value of the activeLog will be returned.
		if (!logName) logName = this.consoleLog.activeLog;

		let consoleLogItem = this.consoleLog[logName];

		if (consoleLogItem.historyRecallIndex !== null) {

			return consoleLogItem.history[consoleLogItem.historyRecallIndex];

		}

		return consoleLogItem.value;

	},
	consoleLogParseInput(data) {

		const consoleInputDom = `#${this.id} .console-log-panel .console-input input`;
		const port = this.consoleLog.activeLog;

		let inputData = $(consoleInputDom).val();

		debug.log(`Parsing console log input: '${inputData}'`);

		this.mdiSend(port, { Msg: inputData });

		// if (port === 'SPJS') {
		// 	// publish('/' + this.id + '/spjs-send', data, id);
		// 	this.newspjsSend({ Msg: inputData, IdPrefix: 'mdi', Type: 'MdiCommand' });
		//  } else {
		// 	// publish('/' + this.id + '/port-sendjson', port, data, id);
		// 	this.newportSendJson(port, { Msg: inputData, IdPrefix: 'mdi', Type: 'MdiCommand' });
		//  }

		this.consoleLogInputStatus(null);

		// If the input field is hilited (aka. red because of bad input), remove that hilite.
		// if (this.consoleLog[port].inputStatus) {
		// }

		// If the input is not the same as the last input, save the input command to history.
		if (!this.consoleLog[port].history.length || this.consoleLog[port].history[0] !== data) {

			this.consoleLog[port].history.unshift(data);

		}

		// debug.log("consoleLog:" + gui.parseObject(this.consoleLog, 2));

		this.consoleLog[port].cmdCount += 1;

		// Clear the input field.
		$(consoleInputDom).val('');

	},
	consoleLogInputStatus(status) {

		let port = this.consoleLog.activeLog;
		let portLog = this.consoleLog[port];

		// If status has not changed, exit this method to avoid unnecessary DOM updates.
		if (portLog.inputStatus === status) return false;

		if (status === 'error') {

			debug.log('Console log input error.');

			let errorData = portLog.history.shift();
			debug.log(`errorData: ${errorData}`);

			portLog.value = errorData;
			portLog.historyRecallIndex = null;

			$(`#${this.id} .console-log-panel .console-input input`).val(errorData);
			$(`#${this.id} .console-log-panel .console-input`).addClass('has-error');

		} else if (status === null) {

			$(`#${this.id} .console-log-panel .console-input`).removeClass('has-error');

		}

		portLog.inputStatus = status;

		return true;

	},
	consoleLogChangeView(logName) {

		if (logName === 'left') {

			const curIndex = this.consoleLog.openLogs.indexOf(this.consoleLog.activeLog);

			if (curIndex === 0) return false;

			logName = this.consoleLog.openLogs[curIndex - 1];

		}

		if (logName === 'right') {

			const curIndex = this.consoleLog.openLogs.indexOf(this.consoleLog.activeLog);

			if (curIndex === this.consoleLog.openLogs.length - 1) return false;

			logName = this.consoleLog.openLogs[curIndex + 1];

		}

		// debug.log("Change visible console log: " + logName);
		let activeLog = this.consoleLog.activeLog;
		let consoleLogPanel = `#${this.id} .console-log-panel .console-log-output.log-${activeLog}`;

		// Set focus to the input field.
		$(`#${this.id} .console-log-panel .console-input input`).focus();

		// If the log panel of the selected tab is already visible, skip DOM updates.
		if (this.consoleLog.activeLog === logName) return false;

		// Hide the console log output that is currently visible.
		$(`#${this.id} .console-log-panel .log-${activeLog}`).addClass('hidden');

		// Make the selected console log panel visible.
		$(`#${this.id} .console-log-panel .log-${logName}`).removeClass('hidden');

		// Make the <li> element of the selected tab 'active'.
		$(`#${this.id} .console-log-panel .nav-tabs > .list-tab-${activeLog}`).removeClass('active');
		$(`#${this.id} .console-log-panel .nav-tabs > .list-tab-${logName}`).addClass('active');

		if (this.consoleLog[logName].value !== this.consoleLog[activeLog]) {

			$(`#${this.id} .console-log-panel .console-input input`).val(this.consoleLogGetInputValue(logName));

		}
		if (this.consoleLog[logName].inputStatus !== this.consoleLog[activeLog].inputStatus) {

			$(`#${this.id} .console-log-panel .console-input`).removeClass(this.consoleLog[activeLog].inputStatus).addClass(this.consoleLog[logName].inputStatus);

		}

		// Change the placeholder of the <input> element.
		$(`#${this.id} .console-log-panel .console-input input`).attr('placeholder', this.consoleLog[logName].placeholder);

		// Set the activeLog property to the logName argument.
		this.consoleLog.activeLog = logName;

		// Scroll to the bottom of the console log.
		$(consoleLogPanel).scrollTop($(consoleLogPanel).prop('scrollHeight'));

		return true;

	}

})  /* arrow-function */
);	/* define */
