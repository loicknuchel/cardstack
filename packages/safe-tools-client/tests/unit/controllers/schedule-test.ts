import { setupTest } from 'ember-qunit';
import { module, test } from 'qunit';

module('Unit | Controller | schedule', function (hooks) {
  setupTest(hooks);

  // TODO: add test to controller
  test('it exists', function (assert) {
    const controller = this.owner.lookup('controller:schedule');
    assert.ok(controller);
  });
});
