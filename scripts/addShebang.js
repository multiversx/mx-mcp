import { promises as fs } from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "build", "index.js");
const shebang = "#!/usr/bin/env node\n";

async function addShebang() {
  try {
    let data = await fs.readFile(filePath, "utf8");

    if (!data.startsWith(shebang)) {
      data = shebang + data;

      await fs.writeFile(filePath, data, "utf8");
      console.log(`Shebang added to ${filePath}`);
    } else {
      console.log(`Shebang already exists in ${filePath}`);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }
}

addShebang();
