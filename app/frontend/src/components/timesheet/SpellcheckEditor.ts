import { TextEditor } from 'handsontable/editors/textEditor';

/**
 * Custom text editor that enables browser spellcheck.
 * Extends Handsontable's built-in TextEditor to add spellcheck="true" attribute.
 */
export class SpellcheckEditor extends TextEditor {
  /**
   * Override createElements to add spellcheck attribute to the textarea
   */
  override createElements() {
    super.createElements();

    // Enable spellcheck on the textarea element
    if (this.TEXTAREA) {
      this.TEXTAREA.setAttribute('spellcheck', 'true');
    }
  }
}
