import { BeforeStartParamsType } from '../../types/googleMeetTypes';
import { GoogleMeetHasNotStarted } from '../../types/googleMeetInterfaces';
import {ServiceDecorator} from "../../../../../core";

// @ts-ignore
@ServiceDecorator
export class MeetNotStartedController implements GoogleMeetHasNotStarted {
  private isMeeting: boolean

  constructor() {}

  public beforeStart({ belowBlockBtnExtMeeting, isMeeting, onMeetWindow, meetingsData, rules }: BeforeStartParamsType) {
    this.isMeeting = isMeeting

    if (rules.autoJoinParticipantsQuantity === 0 && !belowBlockBtnExtMeeting) {
      this.registerMeeting(rules, meetingsData, onMeetWindow)
    } else if (!isMeeting && rules.autoJoinParticipantsQuantity > 0) {
      this.registerMeeting(rules, meetingsData, onMeetWindow)
    }

    return {
      isMeeting: this.isMeeting
    }
  }

  private registerMeeting = (rules, meetingsData, onMeetWindow) => {
    if (!meetingsData) return console.warn('Data is loading')
    const participantsInMeeting = document.querySelectorAll('[jsname="YLEF4c"]').length - 1 // minus 1 because of div includes your personal account`s photo
    const joinBtn: HTMLButtonElement = document.querySelector('[jsname="Qx7uuf"]')

    const autoFullScreen = rules.fullscreenOnJoin
    const autoJoin = rules.autoJoinParticipantsQuantity;

    if (participantsInMeeting >= autoJoin) {
      !onMeetWindow && joinBtn.click() // auto join to meeting
      this.isMeeting = true

      if (autoFullScreen) {
        // @ts-ignore
        chrome.runtime.sendMessage({ action: 'enterFullScreenJoin' })
      }

      console.log('Meeting has started')
    }

    console.log("Meeting has not started")
  }

}
