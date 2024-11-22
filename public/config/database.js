const mongoose = require('mongoose');

// MongoDB Atlas Configuration
const MONGODB_CONFIG = {
    // MongoDB Atlas Cluster Details
    CLUSTER_URL: 'tutortron.ha45b.mongodb.net',
    
    // MongoDB Atlas credentials
    USERNAME: 'bob',
    PASSWORD: 'MH42Qz1Pvc4N8b6C',
    
    // Database name
    DB_NAME: 'tutortron',
    
    // MongoDB connection options
    OPTIONS: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        retryWrites: true,
        w: 'majority'
    }
};

// Function to construct the MongoDB Atlas connection string
const getConnectionString = () => {
    const connectionString = `mongodb+srv://${MONGODB_CONFIG.USERNAME}:${MONGODB_CONFIG.PASSWORD}@${MONGODB_CONFIG.CLUSTER_URL}/${MONGODB_CONFIG.DB_NAME}?retryWrites=true&w=majority`;
    // Log the connection string (remove in production)
    console.log('Attempting to connect with:', connectionString.replace(MONGODB_CONFIG.PASSWORD, '****'));
    return connectionString;
};

// Connect to MongoDB Atlas
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(getConnectionString(), MONGODB_CONFIG.OPTIONS);
        console.log(`MongoDB Atlas Connected: ${conn.connection.host}`);
        
        // Test the connection
        await mongoose.connection.db.admin().ping();
        console.log("Database ping successful");
        
        return conn;
    } catch (error) {
        console.error('MongoDB Atlas Connection Error Details:');
        console.error(`Error Name: ${error.name}`);
        console.error(`Error Message: ${error.message}`);
        if (error.code) {
            console.error(`Error Code: ${error.code}`);
        }
        if (error.stack) {
            console.error('Stack Trace:', error.stack);
        }
        process.exit(1);
    }
};

// Add connection event listeners
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected from MongoDB Atlas');
});

module.exports = {
    config: MONGODB_CONFIG,
    connect: connectDB
}; 