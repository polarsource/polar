import { MagicLink } from "./magic_link";
import { LoginCode } from "./login_code";

const TEMPLATES: Record<string, React.FC<any>> = {
  magic_link: MagicLink,
  login_code: LoginCode,
};

export default TEMPLATES;
