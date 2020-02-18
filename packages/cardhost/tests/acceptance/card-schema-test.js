import { module, test } from 'qunit';
import { click, find, visit, currentURL, fillIn, triggerEvent, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  showCardId,
  addField,
  saveCard,
  removeField,
  dragAndDropNewField,
  dragFieldToNewPosition,
  waitForSchemaViewToLoad,
  waitForCardPatch,
  waitForCardLoad,
  selectField,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { animationsSettled } from 'ember-animated/test-support';
import { cardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';
import { canonicalURL } from '@cardstack/core/card-id';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

const timeout = 5000;
const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
const testCard = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'millenial-puppies',
    csTitle: 'Millenial Puppies',
    csFieldOrder: ['title', 'author', 'body'],
    csFieldSets: {
      embedded: ['author'],
    },
    title: 'test title',
    author: 'test author',
    body: 'test body',
  })
  .withField('title', 'string-field', 'singular')
  .withField('author', 'string-field', 'singular')
  .withField('body', 'string-field', 'singular');
const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [testCard],
});

module('Acceptance | card schema', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    await login();
  });

  test(`adding a new field to a card`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();
    assert.equal(currentURL(), `/cards/${cardPath}/edit/fields/schema`);

    await addField('title-new', 'string-field', true);
    await saveCard();

    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();
    await selectField('title-new');

    assert.dom('[data-test-field="title-new"] [data-test-field-renderer-type]').hasText('title-new (Text)');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    let isolatedFields = card.data.attributes.csFieldSets.isolated;
    assert.equal(card.data.attributes['title-new'], undefined);
    assert.ok(card.data.attributes.csFields['title-new']);
    assert.ok(isolatedFields.includes('title-new'), 'isolated fields sets are correct');
  });

  test(`Can change a card's name`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();
    await showCardId(true);

    await fillIn('#card_name', 'New Card Name');
    await triggerEvent('#card_name', 'keyup');
    await waitForCardPatch();
    assert.dom('#card_name').hasValue('New Card Name');
    assert.dom('.card-renderer-isolated--header').hasText('New Card Name');

    await saveCard();
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();
    await showCardId();
    assert.dom('#card_name').hasValue('New Card Name');
    assert.dom('.card-renderer-isolated--header').hasText('New Card Name');
  });

  test(`can expand a right edge section`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    await showCardId();
    assert.dom('.right-edge--item [data-test-internal-card-id]').doesNotExist();
    await click('[data-test-right-edge-section-toggle="details"]');
    await animationsSettled();
    assert.dom('.right-edge--item [data-test-internal-card-id]').hasText(decodeURIComponent(cardPath));
  });

  test(`changing the label for a field`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    await selectField('title');
    assert.dom('.isolated-card [data-test-field="title"] [data-test-field-renderer-label]').hasText('title');

    await fillIn('[data-test-right-edge] [data-test-schema-attr="label"] input', 'TITLE');
    await triggerEvent('[data-test-right-edge] [data-test-schema-attr="label"] input', 'keyup');
    await waitForCardPatch();

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('TITLE');

    await saveCard();
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    assert.dom('.isolated-card [data-test-field="title"] [data-test-field-renderer-value]').hasText('test title');
    assert.dom('.isolated-card [data-test-field="title"] [data-test-field-renderer-label]').hasText('TITLE');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('TITLE');

    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();
    assert.dom('.isolated-card [data-test-field="title"] .cs-input').hasValue('test title');
    assert.dom('.isolated-card [data-test-field="title"] .cs-input-group--label').hasText('TITLE');
  });

  test(`adding a new field after removing one`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    await removeField('body');

    assert.dom('[data-test-field="body"]').doesNotExist();
    await dragAndDropNewField('string-field');
    assert.dom('[data-test-field="field-1"]').exists();
  });

  test(`move a field's position via drag & drop`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    assert.deepEqual(
      [...document.querySelectorAll(`.isolated-card [data-test-field]`)].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']
    );

    await dragFieldToNewPosition(0, 1);
    assert.deepEqual(
      [...document.querySelectorAll(`.isolated-card [data-test-field]`)].map(i => i.getAttribute('data-test-field')),
      ['author', 'title', 'body']
    );

    await dragFieldToNewPosition(1, 2);
    assert.deepEqual(
      [...document.querySelectorAll(`.isolated-card [data-test-field]`)].map(i => i.getAttribute('data-test-field')),
      ['author', 'body', 'title']
    );

    await dragFieldToNewPosition(1, 0);
    assert.deepEqual(
      [...document.querySelectorAll(`.isolated-card [data-test-field]`)].map(i => i.getAttribute('data-test-field')),
      ['body', 'author', 'title']
    );

    await saveCard();

    assert.deepEqual(
      [...document.querySelectorAll(`.isolated-card [data-test-field]`)].map(i => i.getAttribute('data-test-field')),
      ['body', 'author', 'title']
    );
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.attributes.csFieldOrder, ['body', 'author', 'title']);
  });

  test(`change a field's needed-when-embedded value to true`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    await selectField('title');
    assert.dom('[data-test-schema-attr="embedded"] input[type="checkbox"]').isNotChecked();

    await click('[data-test-schema-attr="embedded"] input[type="checkbox"]');
    await waitForCardPatch();
    assert.dom('[data-test-schema-attr="embedded"] input[type="checkbox"]').isChecked();

    await saveCard();
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    await selectField('title');
    assert.dom('[data-test-schema-attr="embedded"] input[type="checkbox"]').isChecked();

    let cardJson = find('[data-test-card-json]').innerHTML;
    cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    let embeddedFields = card.data.attributes.csFieldSets.embedded;
    assert.ok(embeddedFields.includes('title'), 'embedded fields sets are correct');
  });

  test(`change a field's needed-when-embedded value to false`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    await selectField('author');
    assert.dom('[data-test-schema-attr="embedded"] input[type="checkbox"]').isChecked();

    await click('[data-test-schema-attr="embedded"] input[type="checkbox"]');
    await waitForCardPatch();
    assert.dom('[data-test-schema-attr="embedded"] input[type="checkbox"]').isNotChecked();

    await saveCard();
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    await selectField('author');
    assert.dom('[data-test-schema-attr="embedded"] input[type="checkbox"]').isNotChecked();

    let cardJson = find('[data-test-card-json]').innerHTML;
    cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    let embeddedFields = card.data.attributes.csFieldSets.embedded;
    assert.notOk(embeddedFields.includes('author'), 'embedded fields sets are correct');
  });

  test(`can navigate to base card schema`, async function(assert) {
    let baseCardPath = encodeURIComponent(canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }));
    await visit(`/cards/${baseCardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    await focus(`.card-renderer-isolated`);
    await waitFor(`[data-test-no-adoption]`, { timeout });
    assert.dom(`[data-test-right-edge] [data-test-no-adoption]`).hasText('No Adoption');
  });
});
