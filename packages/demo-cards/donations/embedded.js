import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import './embedded.css';

export default setComponentTemplate(
  precompileTemplate(
    `<BoxelCardContainer @displayBoundaries={{true}}>
      <:header>Donations</:header>
      <:default>
        <div class="donations">
          <h3 class="donations__title"><@fields.title/></h3>
          <p><@fields.description/></p>
        </div>
      </:default>
    </BoxelCardContainer>`,
    {
      strictMode: true,
      scope: () => ({ BoxelCardContainer }),
    }
  ),
  templateOnlyComponent()
);
