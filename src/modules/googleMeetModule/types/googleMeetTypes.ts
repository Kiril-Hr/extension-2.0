import { DisabledFeaturesTypes } from '../../intermediaryServices/types/intermediaryTypes';

export type GoogleMeetTopics = [
  'Daily meet up',
  'Refinement call'
]

export interface MeetTopic {
  title: string,
    rules: {
    // must be a number (+)
    autoJoinParticipantsQuantity: number,
      leaveTogetherWithMyGuys: {
      // may be false or true (+)
      isTurnOn: boolean,
      guys: string[],
      // leaveWhen may be "all" or "one" or "some%" (+)
      leaveWhen: string
    },
    // may be false or true (+)
    fullscreenOnJoin: boolean,
    // may be in range from 0 to 1 (+)
    percentageToLeave: number,
    // may be false or true
    joinWithCameraOff: boolean,
    // may be false or true
    keepTabActive: boolean,
    // may be false or true (+)
    showSubtitles: boolean,
  },
}
export interface Participant {
    participantName: string,
    participantRole: string,
    assignedTo: GoogleMeetTopics,
}

export type GoogleMeetRules = Record<string, MeetTopic>

export interface MeetingsData {
    participants: Participant[]
    googlemeetRules: GoogleMeetRules,
}

export type currentMeetingTitleType = GoogleMeetTopics[number] | 'Topic is absent'

export type exitConfigListType = Omit<Participant, 'assignedTo'>[] | []

export type DomCustomTypes = {
  miniVideo: null | HTMLElement,
}

export type dataTypeMainService = {
  meetingsData: MeetingsData | boolean,
  currentMeetingTitle: currentMeetingTitleType,
  exitConfigList: exitConfigListType,
  rules: MeetTopic['rules'] | null
}

export type meetParticipantsTypeMainService = {
  maxPartyQty: number
  previousPartyQty: number
  party: string[]
  guests: string[]
}

export type streamType = null | MediaStream

export type mediaManipulationsType = {
  mediaRecorderVideo: null | MediaRecorder,
  mediaRecorderAudio: null | MediaRecorder,
  mediaChunks: Blob[],
  audioChunks: Blob[],
  stream: streamType,
  streamVideo: streamType
  streamAudio: streamType,
}

export type localTranslationType = {
  id: string,
  translation: null | HTMLVideoElement,
  autoplay: boolean,
  playsInline: boolean,
  controls: boolean,
  styles: Record<string, string | number>
}

export type InAnyCastType = {
  currentMeetingTitle: currentMeetingTitleType,
  rules: MeetTopic['rules'] | null,
  meetingsData: MeetingsData | boolean,
  disableFeatures: DisabledFeaturesTypes | null,
  previousPartyQty: number
}

export type BeforeStartType = { isMeeting: boolean }

export type HappeningProps = {
  belowBlockBtnExtMeeting: Element,
  redButton: Element,
  sharingNotice: Element,
  sharedScreen: Element,
  recordButton: Element,
  goMessage: Element[],
  previousPartyQty: number,
  rules: MeetTopic['rules'] | null,
  currentMeetingTitle: currentMeetingTitleType,
  meetingsData: MeetingsData | boolean,
  isMeeting: boolean
}

export type BeforeStartParamsType = {
  belowBlockBtnExtMeeting: Element,
  onMeetWindow: boolean,
  meetingsData: MeetingsData | boolean,
  rules: MeetTopic['rules'] | null,
  isMeeting: boolean,
}

export type HappeningPropsReturn = {
  onMeetWindow: boolean,
  scaleTranslationBlock: boolean,
}
