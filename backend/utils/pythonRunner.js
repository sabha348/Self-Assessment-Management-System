const { spawn } = require("child_process");

function sanitizeText(text) {
  return text.replace(/[\r\n]+/g, ' ').trim();
}

function sanitizeArgs(args) {
  return args.map(arg => {
    if (Array.isArray(arg)) {
      // Ensure array is properly stringified without line breaks
      return JSON.stringify(arg).replace(/\n/g, ' ');
    }
    if (typeof arg === 'string') {
      // Clean string arguments
      return sanitizeText(arg);
    }
    return arg.toString();
  });
}

function runPythonProcess(scriptName, args) {
  return new Promise((resolve, reject) => {
    // Clean and prepare arguments
    const sanitizedArgs = sanitizeArgs(args);
    
    console.log('Running Python script:', scriptName);
    console.log('Raw arguments:', args);
    console.log('Sanitized arguments:', sanitizedArgs);

    const pythonProcess = spawn("python", [scriptName, ...sanitizedArgs], {
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8'
      }
    });

    let outputData = "";
    let errorData = "";

    pythonProcess.stdout.on("data", (data) => {
      outputData += data.toString('utf-8');
    });

    pythonProcess.stderr.on("data", (data) => {
      errorData += data.toString('utf-8');
      console.error('Python stderr:', data.toString('utf-8'));
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Process failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        // Handle empty output
        const cleanOutput = outputData.trim();
        if (!cleanOutput) {
          reject(new Error('No output from Python script'));
          return;
        }

        // Parse JSON output
        const result = JSON.parse(cleanOutput);
        resolve(result);
      } catch (e) {
        console.error('Failed to parse Python output:', outputData);
        reject(new Error(`Invalid JSON output from Python: ${e.message}`));
      }
    });
  });
}

module.exports = { runPythonProcess };