import axios from 'axios';

async function testRender() {
  try {
    console.log("Sending request to render video...");
    const response = await axios.post('http://localhost:3000/api/render-video', {
      studentName: 'Test Student'
    });
    console.log("Success:", response.status);
  } catch (error) {
    if (error.response) {
      console.error("Error Response:", error.response.status, error.response.data);
    } else {
      console.error("Error:", error.message);
    }
  }
}

testRender();
