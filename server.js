const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;
async function connectDB() {
    try {
        await client.connect();
        db = client.db('zenith_cms');
        console.log('✅ Connected to MongoDB Atlas (zenith_cms)');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    }
}
connectDB();

// ── GET all posts (newest first) ─────────────────────────────────────────────
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await db.collection('blogs')
            .find()
            .sort({ date: -1 })
            .toArray();
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch posts', details: err.message });
    }
});

// ── GET single post by id ─────────────────────────────────────────────────────
app.get('/api/posts/:id', async (req, res) => {
    try {
        const post = await db.collection('blogs').findOne({ _id: new ObjectId(req.params.id) });
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch post', details: err.message });
    }
});

// ── POST create a new post ────────────────────────────────────────────────────
app.post('/api/posts', async (req, res) => {
    try {
        const { title, category, content, author } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required.' });
        }
        const newPost = {
            title: title.trim(),
            category: (category || 'General').trim(),
            content: content.trim(),
            author: (author || 'Anonymous').trim(),
            date: new Date(),
            updatedAt: null
        };
        const result = await db.collection('blogs').insertOne(newPost);
        res.status(201).json({ message: 'Post created!', id: result.insertedId });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create post', details: err.message });
    }
});

// ── PATCH update an existing post ────────────────────────────────────────────
app.patch('/api/posts/:id', async (req, res) => {
    try {
        const { title, category, content, author } = req.body;
        const updates = {};
        if (title)    updates.title    = title.trim();
        if (category) updates.category = category.trim();
        if (content)  updates.content  = content.trim();
        if (author)   updates.author   = author.trim();
        updates.updatedAt = new Date();

        const result = await db.collection('blogs').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: updates }
        );
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Post not found' });
        res.json({ message: 'Post updated!' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update post', details: err.message });
    }
});

// ── DELETE a post ─────────────────────────────────────────────────────────────
app.delete('/api/posts/:id', async (req, res) => {
    try {
        const result = await db.collection('blogs').deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Post not found' });
        res.json({ message: 'Post deleted!' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete post', details: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));