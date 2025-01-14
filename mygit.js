#!/usr/bin/env node
const { Command } = require('commander');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const readlineSync = require('readline-sync'); // For commit message input

// Initialize the CLI tool
const program = new Command();
program.version('1.0.0');

// Command to initialize a repository
program
    .command('init')
    .description('Initialize a new MyGit repository')
    .action(() => {
        const gitDir = path.join(process.cwd(), '.mygit');

        if (fs.existsSync(gitDir)) {
            console.log('Repository already exists!');
            return;
        }

        // Create necessary directories for the repo
        const dirsToCreate = [
            '.mygit',
            '.mygit/objects',
            '.mygit/refs',
            '.mygit/refs/heads',
        ];

        dirsToCreate.forEach((dir) => {
            const dirPath = path.join(process.cwd(), dir);
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`Created directory: ${dirPath}`);
        });

        // Initialize the HEAD file
        fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
        console.log('Initialized empty MyGit repository');
    });

// Command to stage a file (add)
program
    .command('add <file>')
    .description('Stage a file')
    .action((file) => {
        const filePath = path.join(process.cwd(), file);

        // Check if the file exists
        if (!fs.existsSync(filePath)) {
            console.error(`Error: File ${file} does not exist.`);
            return;
        }

        // Read file content
        const content = fs.readFileSync(filePath);

        // Generate SHA-1 hash
        const hash = crypto.createHash('sha1').update(content).digest('hex');

        // Create object path
        const objectDir = path.join(process.cwd(), '.mygit', 'objects', hash.substring(0, 2));
        const objectPath = path.join(objectDir, hash.substring(2));

        // Ensure directory exists
        fs.mkdirSync(objectDir, { recursive: true });

        // Write file content as a blob
        fs.writeFileSync(objectPath, content);
        console.log(`File ${file} added with hash ${hash}`);

        // Update the staging area (index)
        const indexPath = path.join(process.cwd(), '.mygit', 'index');
        const fileEntry = `${hash} ${file}\n`;

        // If index file exists, append new entry, else create a new one
        fs.appendFileSync(indexPath, fileEntry);
    });

// Command to commit the staged changes
program
    .command('commit')
    .description('Commit the staged changes')
    .action(() => {
        const indexPath = path.join(process.cwd(), '.mygit', 'index');

        // Check if the index exists and has files to commit
        if (!fs.existsSync(indexPath) || fs.readFileSync(indexPath, 'utf-8').trim() === '') {
            console.log('No changes staged for commit.');
            return;
        }

        // Get commit message from user
        const commitMessage = readlineSync.question('Enter commit message: ');

        // Read staged files from the index
        const stagedFiles = fs.readFileSync(indexPath, 'utf-8').split('\n').filter(line => line);

        // Create commit object
        const commitObj = {
            message: commitMessage,
            files: stagedFiles,
            timestamp: new Date().toISOString(),
            parent: fs.existsSync(path.join(process.cwd(), '.mygit', 'refs', 'heads', 'main'))
                ? fs.readFileSync(path.join(process.cwd(), '.mygit', 'refs', 'heads', 'main'), 'utf-8').trim()
                : null
        };

        // Serialize commit object and create a SHA-1 hash
        const commitContent = JSON.stringify(commitObj);
        const commitHash = crypto.createHash('sha1').update(commitContent).digest('hex');

        // Save commit object in objects directory
        const commitDir = path.join(process.cwd(), '.mygit', 'objects', commitHash.substring(0, 2));
        const commitPath = path.join(commitDir, commitHash.substring(2));

        fs.mkdirSync(commitDir, { recursive: true });
        fs.writeFileSync(commitPath, commitContent);

        console.log(`Commit successful with hash: ${commitHash}`);

        // Update the refs/heads/main to point to the new commit
        fs.writeFileSync(path.join(process.cwd(), '.mygit', 'refs', 'heads', 'main'), commitHash);

        // Clear the staging area (index) after commit
        fs.writeFileSync(indexPath, '');

        console.log('Staging area cleared. Commit completed.');
    });

// Parse command-line arguments
program.parse(process.argv);
