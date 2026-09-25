import fs from "node:fs"; import postcss from "postcss"; import tw from "@tailwindcss/postcss";
const root = "C:/Erick/app movil/vida-total-web";
process.chdir(root);
const css = fs.readFileSync("src/app/globals.css", "utf8");
const out = await postcss([tw()]).process(css, { from: root + "/src/app/globals.css" });
fs.writeFileSync(process.argv[2], out.css); console.log("css bytes", out.css.length);
