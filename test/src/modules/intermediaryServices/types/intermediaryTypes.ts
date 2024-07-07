import { MeetingsData } from '../../googleMeetModule/types/googleMeetTypes';

export type DisabledFeaturesTypes = {
  meetService: {
    disableRecordFeature: boolean
  }
}

export interface RulesType {
  meetService: MeetingsData;
  disabledFeatures: DisabledFeaturesTypes
}


export interface filesType {
  microAudio: {
    name: null | string,
    file: null | Blob
  },
}
