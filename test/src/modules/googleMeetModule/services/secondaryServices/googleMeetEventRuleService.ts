import {
  GoogleMeetEventRuleInterface,
  GoogleMeetUtilsInterface
} from "../../types/googleMeetInterfaces";
import {GoogleMeetUtilsService} from "./googleMeetUtilsService";
import { ServiceDecorator, dependencyContainer } from 'devxtension';

@ServiceDecorator
export class GoogleMeetEventRuleService implements GoogleMeetEventRuleInterface {

  constructor (
    public UtilsService: GoogleMeetUtilsInterface = dependencyContainer.getService(GoogleMeetUtilsService.name),
  ) {}

  public checkIfConfigRule = (title, exitConfigList, guests, party, percentageToLeave) => {
    if (!exitConfigList) {
      return false
    }
    // not leads has left more than 73%
    if (title === 'Daily meet up') return this.dailyMeetUpRule(title, exitConfigList, guests, party, percentageToLeave);

    // not participants from the required list
    if (title === 'Refinement call') return this.refinementCallRule(title, exitConfigList, party);
  }

  public dailyMeetUpRule = (title, list, guests, party, percentageToLeave) => {
    const { notLeads, leads } = this.UtilsService.leadsNotLeads(list)
    const guestQty = guests.length
    const maxRegisterNotLeads = notLeads.length + guestQty

    const currentNoLeads = party.filter((p) => !leads.includes(this.UtilsService.leadToGeneral(p))).length

    return currentNoLeads/maxRegisterNotLeads < 1 - percentageToLeave; // Share of current not lead participants from register
  }

  public refinementCallRule = (title, list, party) =>
    !list.filter(item => party.join(' ').includes(item.participantName)).length

}
