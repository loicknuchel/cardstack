import { setComponentTemplate } from "@ember/component";
import { precompileTemplate } from "@ember/template-compilation";
import templateOnlyComponent from "@ember/component/template-only";
export default setComponentTemplate(
  precompileTemplate("Date: {{@model}}", {
    strictMode: true,
  }),
  templateOnlyComponent()
);
