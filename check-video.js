const fs = require('fs');

const file = 'public/renders/test_student_birthday_1774205028110.mp4';
const stats = fs.statSync(file);
console.log("File size:", stats.size);
