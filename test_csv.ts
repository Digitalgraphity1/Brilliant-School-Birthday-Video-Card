import axios from 'axios';
import { parse } from 'csv-parse/sync';

async function test() {
  const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_rEXB4vZe8DalNlybVTUbtESHnU0loPJDlg26z07fIzA6JC7PzpqSruEWrheHJINWnJqlEIkv7rKq/pub?gid=0&single=true&output=csv";
  try {
    const response = await axios.get(url);
    console.log("CSV data received.");
    const records = parse(response.data, {
      columns: true,
      skip_empty_lines: true,
    });
    console.log(`Parsed ${records.length} students.`);
    console.log("First record:", records[0]);
  } catch (error) {
    console.error("Error fetching students:", error);
  }
}

test();
