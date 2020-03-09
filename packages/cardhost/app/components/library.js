import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class Library extends Component {
  @service library;
  @service scroller;
  @service overlays;

  @tracked selectedSection = 'recent-cards';
  @tracked cardModel;
  @tracked dialogTitle;
  @tracked showDialog;

  constructor(...args) {
    super(...args);

    this.library.getRecentCardsTask.perform();
  }

  @action
  openCardNameDialog(title, model /*, evt*/) {
    if (arguments.length > 2) {
      this.cardModel = model;
    }
    if (arguments.length > 1) {
      this.dialogTitle = title;
    }
    this.showDialog = true;
  }

  @action
  closeDialog() {
    this.showDialog = false;
    this.cardModel = null;
  }

  @action
  scrollToSection(sectionId) {
    if (!sectionId) {
      return;
    }
    this.scroller.scrollToSection({
      selector: `.library-section--${sectionId}`,
      elementOffset: 60,
      doneScrolling: () => (this.selectedSection = sectionId),
    });
  }
}
