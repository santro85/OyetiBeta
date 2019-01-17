var TOTAL_RECORDING_TIME = 2*1000  // in ms
var context = null;
var recorder_node = null;
var isStreaming = false;
var isSocketConnected = false;
var audioStream = null;
var stop_sending = true;
var timer;
var isRunning = false;
var counter;
var sample_rate = null;
var numChannels =1;

var UPLOAD_URL =  "https://" + document.domain + ":5000/identify/v3/upload";
var TRANSACTION_ENDPOINT = "https://" + document.domain + ":5000/vpa_transfer/v1/";

function start_stopwatch(){
  timer = 0.0;
  isRunning = true;

  counter = setInterval(function(){
    if(isRunning){
      document.getElementById("stopwatch").textContent = "processing: " + timer/1000 + "s";
      timer = timer + 100;
    }

  }, 100);
}

function reset_stopwatch(){
  timer = 0;
  isRunning = false;
  clearInterval(counter);

}

function stopStreaming() {
    audioStream.getTracks().forEach(function(track) {
        track.stop();
    });
    context.close();
    isStreaming = false;
    //document.getElementById("record_button").style.backgroundImage = "url(/static/images/start.png)";
    //reset_stopwatch();
}


function display_result(msg){
  document.getElementById('count_down_section').classList.add('hide');
  response = JSON.parse(msg);
  if(response['success']){
    document.getElementById('merchant_box').classList.remove('hide');
    document.getElementById('heading').textContent = "Congratulations";
    merchant_name = response['merchant_details']['name'];
    document.getElementById('merchant_name').textContent = merchant_name;
    console.log('merchant_name: ' + merchant_name);
    if (response['offer']['tt_offer']){
      document.getElementById('offer_title').textContent = response['offer']['cb_title'];
      document.getElementById('offer_description').textContent = response['offer']['cb_description'];
      //document.getElementById('info_box').classList.remove('hide');
      document.getElementById('grab_button').style.visibility = "visible";
    }
    else{
      document.getElementById('offer_title').textContent = "no offer available";
      document.getElementById('offer_description').textContent = '';
      document.getElementById('grab_button').style.visibility = "hidden";
    }
  }
  else{
    document.getElementById('error_box').classList.remove('hide');
    console.log('merchant_name: ' + 'not found' );

  }

}


function get_song(blob, sample_rate){
  console.log('sample rate in get_song, ', sample_rate);
  console.log(blob, sample_rate);
  var formData = new FormData();
  console.log(formData);
  formData.append('file', blob, 'audio_recording');
  formData.append('sample_rate', sample_rate)
  console.log(UPLOAD_URL);
  var xhr = new XMLHttpRequest();
  xhr.open('POST', UPLOAD_URL, true);
  xhr.onload = function(){
      if (xhr.status == 200){
        console.log('xhr success');
        console.log(xhr.responseText);
        display_result(xhr.responseText);
      }
      console.log('inside xhr onload');
  }
  xhr.send(formData);
}

function recordStream(stream){
  console.log('in recordStream function');
  stream.getTracks().forEach(function(track) {
		console.log(track.getSettings());
  });

  // Get the samplerate
  context = new AudioContext();
  sample_rate = context.sampleRate
  context.close();
  console.log("samplerate: " + sample_rate);
  params  = {mimeType: "audio/webm"};
  var mediaRecorder = new MediaRecorder(stream, params);
  var chunk_duration = 500;
  mediaRecorder.start(chunk_duration);

  var audiochunks = [];

  var counter = 0;
  var max_counter = TOTAL_RECORDING_TIME/chunk_duration;
  console.log('max_ counter: ', max_counter);
  mediaRecorder.ondataavailable = function(event){
    console.log("counter: " + counter);
    if (counter <= max_counter){
      audiochunks.push(event.data);
      console.log('added event data to audiochunks');
    }
    else{
      var audioBlob = new Blob(audiochunks, {type: "audio/webm"});
      stream.getTracks().forEach(function(track) {
          track.stop();
      });
      get_song(audioBlob, sample_rate);
    }
    counter += 1;
  }
}

function get_speakerphone(){
  var speakerPhone_id = null;
  navigator.mediaDevices.enumerateDevices().then(function(devices) {
    devices.forEach(function(device) {
      console.log(device);
      if(device.label == 'Speakerphone'){
          speakerPhone_id = device.deviceId;
          console.log('found speakerPhone, deviceId: ' + speakerPhone_id);
          return
      }
    });
});
  console.log('Returning speakerphone_id' + speakerPhone_id);
  return speakerPhone_id;
}


function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        //let s = input[i];
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function encodeWAV(samples) {
    let buffer = new ArrayBuffer(44 + samples.length * 2);
    let view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* RIFF chunk length */
    view.setUint32(4, 36 + samples.length * 2, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, 1, true);
    /* sample rate */
    view.setUint32(24, sample_rate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sample_rate * 2, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 1*2, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    floatTo16BitPCM(view, 44, samples);

    return view;
}


function mergeBuffers(recBuffers, recLength) {
   let result = new Float32Array(recLength);
   let offset = 0;
   for (let i = 0; i < recBuffers.length; i++) {
       result.set(recBuffers[i], offset);
       offset += recBuffers[i].length;
   }
   return result;
}

function forceDownload(blob, filename) {
  console.log('inside forceDownload');
    let url = (window.URL || window.webkitURL).createObjectURL(blob);
    console.log(url);

    let link = window.document.createElement('a');
    link.href = url;
    link.download = filename || 'output.wav';
    let click = document.createEvent("Event");
    click.initEvent("click", true, true);
    link.dispatchEvent(click);
}

async function push_array(chunks, array, counter){
  chunks.push(array);
  console.log('pushed into chunks ' +  counter);
  return 0;
}


function record_processor(stream){
  audioStream = stream;
    console.log('in record_processor');
    context = new AudioContext();
    var source  = context.createMediaStreamSource(stream);
    buffer_size = 1024*16;
    console.log('buffer_size ' + buffer_size );

    var processor = context.createScriptProcessor(buffer_size,1,1);
    source.connect(processor);
    processor.connect(context.destination);

    sample_rate = context.sampleRate;
    console.log('sample rate: ' + sample_rate);

    total_iterations = ((TOTAL_RECORDING_TIME*sample_rate)/(1000*buffer_size));
    counter = 0;
    var chunks = [];
    processor.onaudioprocess = function (e){
      var buffer = new Float32Array(e.inputBuffer.getChannelData(0));
      push_array(chunks, buffer, counter);
      console.log(counter);

      counter +=1;
      if(counter > total_iterations){
        console.log('iterations complete');
        stopStreaming();
        data = mergeBuffers(chunks, chunks.length*buffer_size);
        wav_view = encodeWAV(data);

        var audioBlob = new Blob([wav_view], {type: 'audio/wav'});
        get_song(audioBlob, sample_rate);
      }
    };
}


function record_js(stream){
  // function for recording via recorder.js script
  var audio_tracks = stream.getAudioTracks();

  console.log('default:: ' + audio_tracks[0].label);
  console.log(audio_tracks[0]);
  //get_audio_device();
  context = new AudioContext();
  sample_rate = context.sampleRate;
  console.log('sample_rate: ' + sample_rate);

  source = context.createMediaStreamSource(stream);
  recorder = new Recorder(source, {numChannels: 1,
                                   recordingGain:1,
                                   bufferLen: 1024*2});

  // Start recording
  recorder.record()
  console.log('Recording has started.. Recording for ' + TOTAL_RECORDING_TIME + 'ms');
  //stop recording after some time
  setTimeout(function(){
    recorder.stop();
    console.log('Recording stopped');
    stream.getTracks().forEach(function(track) {
        track.stop();

    // export wav file and upload it
    recorder.exportWAV(function(blob){
      forceDownload(blob, 'recording.wav');
      get_song(blob, sample_rate);
    });
    });
    recorder.clear();     // clear the arr
  },TOTAL_RECORDING_TIME);

}

function get_user_media(id){
  console.log('inside get user media');
  console.log("id: " + id);
  var constraints =  {
                      optional: [
                          {EchoCancellation: false},
                          {autoGainControl: false},
                          //  {googEchoCancellation: false},
                          //  {googEchoCancellation2: false},
                          //  {googDAEchoCancellation: false},
                          // {intelligibilityEnhancer: false},
                          //  {googAutoGainControl: false},
                          //  {googAutoGainControl2: false},
                          // {googNoiseSuppression: false},
                          // {googNoiseSuppression2: false},
                          // {levelControlInitialPeakLevelDBFS: false},
                          // {googTypingNoiseDetection: false},
                          // {googHighpassFilter: false},
                          // {googAudioMirroring: false},
                          //  {googNoiseReduction: false},
                          //  {VoiceActivityDetection: false},
                          // {IceRestart: false},
                          // {googUseRtpMUX: false},
                            {NoiseSuppression: false}
                        ]
                      };

  //console.log(constraints);
  navigator.mediaDevices.getUserMedia({audio: constraints}).then(record_processor);
}

function Record() {
    console.log('Record button tapped');
    if (!isStreaming) { //When not recording
      console.log('preparing to record');
      // navigator.mediaDevices.enumerateDevices().then(function(devices) {
      //   for (var i = 0; i < devices.length; i++) {
      //     device = devices[i];
      //     console.log(i, device);
      //     if (device.label == 'Speakerphone'){
      //       speakerPhone_id = device.deviceId;
      //       console.log('  speakerPhone, deviceId: ' + speakerPhone_id);
      //     }
      //   }
        //get_user_media(speakerPhone_id);
        get_user_media(null);

    }
    else {
      stopStreaming();
      console.log("recording has been stopped");
    }

}

// Start recording as soon as the page starts loading
Record();
console.log('Recording started...');

// Handle try-again button click
function Try_Again(){
  console.log('Try again was tapped. Reloading the page');
  document.location.reload();
}

// Handle the grab offer click event
function Grab_Offer(){
  document.getElementById('merchant_box').classList.add('hide');
  document.getElementById('info_box').classList.remove('hide');
};


function startCountDown(){
    var counter = 3;
    var Countdown = setInterval(function(){
    $("#count_num span").html(counter);
    counter--;
    if (counter == -1) {
      clearInterval(Countdown);
      $(".countdown-box").addClass("hide");
    }
}, 1000);
}

// Run the countdown when window is completed loaded
window.onload = function(){
  startCountDown();
};

// Handle the transaction part in the end
function Make_Transaction(){
  phone_value = document.getElementById('phone').value;
  console.log('phone: ' + phone_value);
  vpa_value = document.getElementById('vpa').value;


  // Make a post request
  var formData = new FormData();
  console.log('vpa ' + vpa_value);
  formData.append('phone', phone_value);
  formData.append('vpa', vpa_value);
  console.log(TRANSACTION_ENDPOINT);

  var xhr = new XMLHttpRequest();
  xhr.open('POST', TRANSACTION_ENDPOINT, true);
  document.getElementById('loader-box').classList.remove('hide');
  document.getElementById('info_box').classList.add('hide');
  xhr.onload = function(){
      if (xhr.status == 200){
        console.log('xhr success');
        console.log(xhr.responseText);
        data = JSON.parse(xhr.responseText);
        document.getElementById('loader-box').classList.add('hide');
        if (data['success']){
                document.getElementById('grab_success').classList.remove('hide');
                document.getElementById('success_msg').textContent = data['message'];
              }
              else{
                document.getElementById('grab_failure').classList.remove('hide');
                document.getElementById('error_msg').textContent = data['message'];
              }
        }
  }
  xhr.send(formData);


};

function Grab_Failure(){
  document.getElementById('info_box').classList.remove('hide');
  document.getElementById('grab_failure').classList.add('hide');
}

function Home(){
  window.location.href = window.location;
}
