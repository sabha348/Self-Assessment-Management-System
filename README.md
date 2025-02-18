# Self-Assessment Management System (SAMS)

## Overview
The Assessment Management System (SAMS) is a comprehensive web application designed to help users self-assess their comprehension of various topics. Built with the MERN stack (MongoDB, Express.js, React.js, Node.js) and Python for AI capabilities, the system provides intelligent question generation, answer evaluation, and personalized learning analytics.

## Features
### Core Features
- AI-powered question generation from uploaded content
- Intelligent answer evaluation with detailed feedback
- Multiple question formats (MCQ, Fill in the blanks, Open-ended)
- Performance analytics and progress tracking
- Cloud storage integration (Google Drive)
- Premium membership system

### Admin Features

- Subscription Management

  - View and manage user subscriptions
  - Monitor subscription status and renewals
  - Handle subscription upgrades/downgrades
  - Process refund requests


- User Management

  - View all user accounts
  - Monitor user activity
  - Handle user reports/issues


- Analytics Dashboard

  - Subscription metrics
  - Revenue reports
  - User engagement statistics
  - Feature usage analytics


- System Configuration

  - Manage subscription tiers
  - Configure feature access per tier
  - Set pricing
  - Define usage limits


### Premium Features
- Unlimited question generation
- Customizable question difficulty
- Smart break suggestions based on retention
- Automated study timetable generation
- Advanced analytics dashboard

## Tech Stack
### Frontend
- React.js
- Redux for state management
- Material-UI/Tailwind CSS for styling
- Chart.js for analytics visualization

### Backend
- Node.js with Express.js
- MongoDB for database
- Python for AI processing
- JWT for authentication

## AI Components
- Google's Gemini AI model integration for:
  - Intelligent question generation from input text
  - Advanced answer evaluation with semantic analysis
  - Smart comparison between user answers and correct responses
- Features multiple evaluation modes:
  - Lenient: More flexible scoring with higher partial match bonuses
  - Balanced: Standard evaluation with moderate weights
  - Strict: Rigorous evaluation with emphasis on semantic accuracy
- Custom similarity evaluation system using:
  - Semantic similarity scoring
  - Keyword matching and analysis
  - Configurable accuracy thresholds
- Fallback mechanisms for robust operation
  

## Installation

### Prerequisites
```bash
# Node.js 16+ and npm
# Python 3.8+
# MongoDB 4.4+
```

### Backend Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/assessment-management-system.git

# Install Node.js dependencies
cd backend
npm install

# Install Python dependencies
cd python
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env

# Start development server
npx nodemon server.js
```

### Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

## Configuration
Create a `.env` file in the backend directory with the following variables:
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GOOGLE_DRIVE_API_KEY=your_google_drive_api_key
GOOGLE_API_KEY=your_gemini_api_key
```

## API Documentation
The API documentation is available at `/api/docs` when running the server locally. It includes:
- Authentication endpoints
- Question generation API
- Answer evaluation endpoints
- User management routes
- Analytics endpoints

## Database Schema
Key collections in MongoDB:
- Users
- Questions
- Answers
- PerformanceMetrics
- Subscriptions
- TimeTable

## Testing
```bash
# Run backend tests
cd backend
npm test

# Run frontend tests
cd frontend
npm test
```

## Deployment
### Docker Deployment
```bash
# Build images
docker-compose build

# Start services
docker-compose up
```

### Manual Deployment
1. Set up a MongoDB instance
2. Deploy the Python AI service
3. Deploy the Node.js backend
4. Deploy the React frontend
5. Configure nginx for routing

## Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License
This project is licensed under the MIT License - see the LICENSE.md file for details.

## Support
For support, email sabha341781@gmail.com or create an issue in the repository.
