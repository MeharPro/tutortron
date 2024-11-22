import { Application } from '@cfworker/web';
const express = require('express');
const path = require('path');
const { connect: connectDB } = require('./public/config/database');
const Teacher = require('./public/models/Teacher');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const JWT_SECRET = env.JWT_SECRET;
const MONGODB_URI = env.MONGODB_URI;
const client = new MongoClient(MONGODB_URI);

// Initialize the app
const app = new Application();

// Middleware order is important!
app.use(cors());
app.use(express.json());

// Serve static files - this should come BEFORE the API routes
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
connectDB();

// API Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, school, accessCode } = req.body;

        // Basic validation
        if (!name || !email || !password || !school || !accessCode) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Verify access code - this should match what you give to teachers
        const validAccessCode = 'TEACH2024'; // This is the code teachers need to enter
        if (accessCode !== validAccessCode) {
            return res.status(401).json({ message: 'Invalid access code' });
        }

        // Check if teacher already exists
        const existingTeacher = await Teacher.findOne({ email });
        if (existingTeacher) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Create new teacher
        const teacher = new Teacher({
            name,
            email,
            password,
            school
        });

        await teacher.save();

        res.status(201).json({ message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic validation
        if (!email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Find teacher by email
        const teacher = await Teacher.findOne({ email });
        if (!teacher) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await teacher.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Create JWT token using the defined secret
        const token = jwt.sign(
            { teacherId: teacher._id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            teacher: {
                id: teacher._id,
                name: teacher.name,
                email: teacher.email,
                school: teacher.school
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

app.get('/api/auth/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const teacher = await Teacher.findById(decoded.teacherId);
        
        if (!teacher) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        res.json({ valid: true });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ message: 'Invalid token' });
    }
});

app.get('/api/links', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const teacher = await Teacher.findById(decoded.teacherId);
        
        if (!teacher) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        res.json(teacher.links || []);
    } catch (error) {
        console.error('Error getting links:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/links', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const teacher = await Teacher.findById(decoded.teacherId);
        
        if (!teacher) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        const { subject, prompt } = req.body;
        const linkId = Math.random().toString(36).substr(2, 9);
        
        teacher.links.push({
            id: linkId,
            subject,
            prompt,
            created: new Date()
        });

        await teacher.save();
        res.status(201).json({ message: 'Link created', linkId });
    } catch (error) {
        console.error('Error creating link:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/links/:linkId', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const teacher = await Teacher.findById(decoded.teacherId);
        
        if (!teacher) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        const linkId = req.params.linkId;
        teacher.links = teacher.links.filter(link => link.id !== linkId);
        await teacher.save();
        
        res.json({ message: 'Link deleted' });
    } catch (error) {
        console.error('Error deleting link:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/tutor/:linkId', async (req, res) => {
    try {
        const { linkId } = req.params;
        
        // Find teacher that has this link
        const teacher = await Teacher.findOne({ 'links.id': linkId });
        if (!teacher) {
            return res.status(404).json({ message: 'Tutor link not found' });
        }

        const link = teacher.links.find(l => l.id === linkId);
        res.json({
            subject: link.subject,
            prompt: link.prompt
        });
    } catch (error) {
        console.error('Error fetching tutor config:', error);
        res.status(404).json({ message: 'Tutor link not found' });
    }
});

// Create an invalid link page
app.get('/invalid-link.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'invalid-link.html'));
});

// Handle tutor routes
app.get('/tutor/:linkId', async (req, res) => {
    try {
        const { linkId } = req.params;
        
        // Check if the link exists
        const teacher = await Teacher.findOne({ 'links.id': linkId });
        if (!teacher) {
            // Redirect to invalid link page if link doesn't exist
            return res.redirect('/invalid-link.html');
        }

        // If link exists, serve the tutor page
        res.sendFile(path.join(__dirname, 'public', 'tutor.html'));
    } catch (error) {
        res.redirect('/invalid-link.html');
    }
});

// Catch-all route should be LAST
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
}; 