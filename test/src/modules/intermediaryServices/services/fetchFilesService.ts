import { filesType } from '../types/intermediaryTypes';
import { FetchFilesInterface } from '../types/intermediaryInterfaces';

export class FetchFilesService implements FetchFilesInterface {
  private files: filesType = {
    microAudio: {
      name: null,
      file: null,
    },
  }

  constructor() {}

  // this method and derivative method need to delete because process of playing audio into user microphone is realized in desktop app
  public async getMicroAudio(name: string) {
    if (this.files.microAudio.name !== name) {
      await this.fetchMicroAudio(name)
    }

    return { microAudio: this.files.microAudio.file }
  }

  private async fetchMicroAudio(name: string) {
    try {
      const response = await fetch(`${process.env.DB_HOST}/get-micro-audio/${name}`)

      if (response.ok) {
        this.files.microAudio.file = await response.blob()
        this.files.microAudio.name = name
      } else {
        console.error('Failed to download file')
      }

    } catch (e) {
      console.error(e)
    }
  }

}
