import {
  BeforeStartParamsType,
  BeforeStartType,
  HappeningProps, HappeningPropsReturn,
  InAnyCastType,
  localTranslationType,
  MeetingsData,
  MeetTopic,
} from './googleMeetTypes';
import {currentMeetingTitleType, exitConfigListType} from "./googleMeetTypes";
import {GeneralServiceInterface} from "../../../../core";

export interface GoogleMeetInterface extends GeneralServiceInterface {
    run(): void
    executor(): void
}

export interface GoogleMeetInAnyCase extends GeneralServiceInterface {
  executingInAnyCase(): InAnyCastType
}

export interface GoogleMeetHasNotStarted extends GeneralServiceInterface {
  beforeStart({ isMeeting, meetingsData, belowBlockBtnExtMeeting, onMeetWindow, rules }: BeforeStartParamsType): BeforeStartType
}

export interface GoogleMeetIsTakingPlace extends GeneralServiceInterface {
  meetingHasStartedAndItIsHappening({ belowBlockBtnExtMeeting, redButton, sharedScreen, sharingNotice, recordButton, goMessage }: HappeningProps): HappeningPropsReturn
}

export interface GoogleMeetDateInterface extends GeneralServiceInterface {
    getLocaleTime(time: string, toLocaleString?: boolean): Date | string
}

export interface GoogleMeetUtilsInterface extends GeneralServiceInterface {
    convertTimeWithZero(time: Date | string): string
    leadToGeneral(name: string): string
    leadsNotLeads(list: exitConfigListType): { leads: string[], notLeads: string[] }
    myRole(list: exitConfigListType)
    delay(executeFn: () => void, delay: number): void
    onSubtitles(settingsMenu: HTMLElement): void
    handleManyClick(element: HTMLElement, clickQty: number, func?: Function): void
    stylesHandle(styles: Record<string, string | number>): string
}

export interface GoogleMeetConditionInterface extends GeneralServiceInterface {
    checkIfAlone(party: string[]): boolean
    checkIfAloneAndScreenSharing(party: string[]): boolean
    conditionForTwoLeads(exitConfigList: exitConfigListType, party: string[]): boolean
    exitMeeting(redButton: Element, party: string[], exitConfigList: exitConfigListType, isMeeting: boolean, controller: number): void
    leaveWithMyFriendsHandle(meetingsData: MeetingsData | boolean, rules: MeetTopic['rules'], party: string[]): void | boolean
}

export interface GoogleMeetEventRuleInterface extends GeneralServiceInterface {
    checkIfConfigRule(title: currentMeetingTitleType, exitConfigList: exitConfigListType, guests: string[], party: string[], percentageToLeave: number): boolean
    dailyMeetUpRule(title: currentMeetingTitleType, list: exitConfigListType, guests: string[], party: string[], percentageToLeave: number): boolean
    refinementCallRule(title: currentMeetingTitleType, list: exitConfigListType, party: string[]): boolean
}

export interface GoogleMeetMainFunctionsInterface extends GeneralServiceInterface {
    getParty()
    guestsHandler(exitConfigList: exitConfigListType, party: string[]): string[]
    getMeetTopic(meetingsData: MeetingsData | boolean): currentMeetingTitleType
}

export interface GoogleMeetFullScreenInterface extends GeneralServiceInterface {
  enterFullScreenForParticipant(isFullScreenEnabled: boolean, exitFullScreen: boolean): { isFullScreenEnabledAfter: boolean }
  checkScreenSharing(sharedScreen, isScreenSharingActive, isFullScreenEnabled, exitFullScreen): { isScreenSharingActive: boolean, isFullScreenEnabled: boolean }
}

export interface GoogleMeetDOMManipulationsInterface extends GeneralServiceInterface {
  turnOnOffCameraHandle(cameraBtn: HTMLButtonElement): void
  createRecordButton(belowBlockBtnExtMeeting: Element): HTMLButtonElement
  controlBlockTranslationShow(Id: string): void
  controlBlockTranslationHide(Id: string): void
  disableCamera(belowSectionWithBtnExtMeet: Element): Promise<{ isCameraOff: boolean, cameraUI: HTMLDivElement, cameraBtn: HTMLButtonElement }>
  manageSubtitles(): boolean
}

export interface GoogleMeetMediaInterface extends GeneralServiceInterface {
  localeTranslation: localTranslationType
  recordAudio(): void
  startRecording(): void
  scaleNewTranslationBlock(video: HTMLVideoElement): void
  catchingTranslation(): Promise<void>
  stopRecording(): void
  deleteLocalTranslationBlock(): void
  playInMicro(name?: string): Promise<void>
}

