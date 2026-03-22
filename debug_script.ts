import axios from 'axios';
import fs from 'fs';

async function run() {
  try {
    const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_rEXB4vZe8DalNlybVTUbtESHnU0loPJDlg26z07fIzA6JC7PzpqSruEWrheHJINWnJqlEIkv7rKq/pub?gid=0&single=true&output=csv";
    const response = await axios.get(url);
    fs.writeFileSync("debug_csv.txt", response.data.split('\n').slice(0, 10).join('\n'));
    console.log("Success");
  } catch (e) {
    console.error(e);
  }
}
run();
