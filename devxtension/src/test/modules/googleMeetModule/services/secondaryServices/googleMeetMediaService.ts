import { GoogleMeetUtilsInterface, GoogleMeetMediaInterface } from '../../types/googleMeetInterfaces';
import { GoogleMeetUtilsService } from './googleMeetUtilsService';
import { localTranslationType, mediaManipulationsType } from '../../types/googleMeetTypes';
import { GeneralIntermediaryInterface } from '../../../intermediaryServices/types/generalIntermediaryInterface';
import GeneralIntermediary from '../../../intermediaryServices/intermediaryService';
import {dependencyContainer, ServiceDecorator} from "../../../../../core";

declare global {
  interface HTMLAudioElement {
    captureStream(): MediaStream;
  }
  interface HTMLVideoElement {
    captureStream(): MediaStream;
  }
}

// @ts-ignore
@ServiceDecorator
export class GoogleMeetMediaService implements GoogleMeetMediaInterface {
  public localeTranslation: localTranslationType = {
    id: 'local-video',
    translation: null,
    autoplay: true,
    playsInline: true,
    controls: false,
    styles: {
      position: 'absolute',
      top: '0',
      left: '0',
      height: '100vh',
      width: '100vw',
      background: '#202124',
      ['z-index']: 1001,
    }
  }
  private mediaManipulations: mediaManipulationsType = {
    stream: null,
    streamVideo: null,
    streamAudio: null,
    mediaRecorderVideo: null,
    mediaRecorderAudio: null,
    mediaChunks: [],
    audioChunks: [],
  }

  constructor(
    public UtilsService = dependencyContainer.getService<typeof GoogleMeetUtilsService>(GoogleMeetUtilsService.name),
    public IntermediaryService: GeneralIntermediaryInterface = GeneralIntermediary, // refactor getMicroAudio, because audios will be running through desktop app interface
  ) {}

  public async startRecording() {
    try {
      this.mediaManipulations.stream = await navigator.mediaDevices.getDisplayMedia({video: true, audio: true})

      await this.recordAudio()

      this.mediaManipulations.mediaRecorderVideo = new MediaRecorder(this.mediaManipulations.stream)

      this.mediaManipulations.mediaRecorderVideo.onstop = async () => {
        await this.sendRecordToServer()
      }

      this.mediaManipulations.mediaRecorderVideo.ondataavailable = (e) => {
        this.mediaManipulations.mediaChunks.push(e.data)
        console.log('Data available:', e.data);
      }

      this.mediaManipulations.mediaRecorderVideo.start()

    } catch (e) {
      console.error(e)
    }
  }

  public stopRecording() {
    if (this.mediaManipulations.mediaRecorderVideo) {
      this.mediaManipulations.mediaRecorderVideo.stop();
      this.mediaManipulations.mediaRecorderAudio.stop();
      this.releaseResources();
    }
  }

  public scaleNewTranslationBlock(video: HTMLVideoElement) {
    this.mediaManipulations.streamVideo = video.captureStream()
    this.localeTranslation.translation = document.createElement('video') as HTMLVideoElement
    console.log( this.localeTranslation.translation, ' ------------------------------ > translation !')
    Object.entries(this.localeTranslation).forEach(([name, value]) => name !== 'styles' && (this.localeTranslation.translation[name] = value));

    this.localeTranslation.translation.style.cssText = this.UtilsService.stylesHandle(this.localeTranslation.styles);

    document.body.appendChild(this.localeTranslation.translation);

    (async () => await this.catchingTranslation())();
  }

  public deleteLocalTranslationBlock() {
    if (this.localeTranslation.translation) {
      this.localeTranslation.translation.remove()
    }
  }

  // need to implement logic of capturing screen sharing of other participants (need to select a video which is being played during meeting by one of the meet participants). Implementation has to be run in main service
  public async catchingTranslation() {
    try {
      this.localeTranslation.translation.srcObject = this.mediaManipulations.streamVideo
    } catch(e) {
      console.error('Error catching translation', e);
    }
  }

  // need to change recording audio tags to logic of recording extension user microphone via getUserMedia
  public async recordAudio() {
    try {
      const audioTags = Array.from(document.querySelectorAll('audio'))

      const audioStreams = audioTags.map((audioStream) => audioStream.captureStream())

      this.mediaManipulations.streamAudio = new MediaStream()

      audioStreams.forEach((audioStream) => {
        audioStream.getAudioTracks().forEach((track) => {
          this.mediaManipulations.streamAudio.addTrack(track)
        })
      })

      this.mediaManipulations.mediaRecorderAudio = new MediaRecorder(this.mediaManipulations.streamAudio)

      this.mediaManipulations.mediaRecorderAudio.onstop = async () => {
        await this.sendAudioToServer()
      }

      this.mediaManipulations.mediaRecorderAudio.ondataavailable = (e) => {
        this.mediaManipulations.audioChunks.push(e.data)
        console.log('Audio data available:', e.data);
      }

      this.mediaManipulations.mediaRecorderAudio.start()

    } catch (e) {
      console.error(e)
    }
  }

  // does not work as it should
  public async playInMicro(name?: string) {
    if (!name) name = 'audio'

    try {
      const { microAudio } = await this.IntermediaryService.fetchFilesService.getMicroAudio(name)

      if (microAudio) {
        const blobURL = URL.createObjectURL(microAudio)
        const audioElement: HTMLAudioElement = new Audio(blobURL)

        audioElement.addEventListener('canplaythrough', async () => {
          const audioStream = audioElement.captureStream()
          const audioContext = new AudioContext()

          const microphone = audioContext.createMediaStreamDestination()
          const audioSource = audioContext.createMediaStreamSource(audioStream)

          audioSource.connect(microphone)

          const audioInput = await navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function(stream) {
              console.log(stream, '-------------------------------- > micro is available')
              return stream
            })
            .catch(function(error) {
              console.error('Error during getting micro:', error);
            });

          const audioTrack = (audioInput as MediaStream).getAudioTracks()[0]

          audioTrack.enabled = false

          await audioElement.play()

          microphone.stream.getAudioTracks().forEach((track) => {
            console.log('Audio track data:', track);
          })

          audioTrack.enabled = true
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  private async sendRecordToServer() {
    const blob = new Blob(this.mediaManipulations.mediaChunks, {
      type: 'video/mp4',
    })
    const formData = new FormData()
    formData.append('video', blob, 'recorded-translation.mp4')

    try {
      const response = await fetch(`/upload-translation`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        console.log('File uploaded successfully on the server.');
      } else {
        console.error('Error uploading file on the server:', response.statusText);
      }
    } catch (error) {
      console.error('Error uploading file on the server:', error);
    }
  }

  private async sendAudioToServer() {
    const blob = new Blob(this.mediaManipulations.audioChunks, {
      type: 'audio/mp4',
    })
    const formData = new FormData()
    formData.append('audio', blob, 'recorded-audio.mp4')

    try {
      const response = await fetch(`/upload-audio`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        console.log('File uploaded successfully on the server.');
      } else {
        console.error('Error uploading file on the server:', response.statusText);
      }
    } catch (error) {
      console.error('Error uploading file on the server:', error);
    }
  }

  private releaseResources() {
    //if (this.mediaManipulations.stream) {
    //  this.mediaManipulations.stream.getTracks().forEach(track => track.stop())
    //}

    this.mediaManipulations = {
      stream: null,
      streamVideo: null,
      streamAudio: null,
      mediaRecorderVideo: null,
      mediaRecorderAudio: null,
      mediaChunks: [],
      audioChunks: [],
    }
  }

}
