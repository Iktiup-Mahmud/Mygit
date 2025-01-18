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

        // Initialize the HEAD file and index file
        fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
        fs.writeFileSync(path.join(gitDir, 'index'), ''); // Ensure index exists

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
        const content = fs.readFileSync(filePath, 'utf-8');

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
        let indexContent = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : '';

        // Remove previous entry for the same file
        indexContent = indexContent.split('\n').filter(line => !line.includes(` ${file}`)).join('\n');

        // Append the new entry
        const fileEntry = `${hash} ${file}\n`;
        fs.writeFileSync(indexPath, indexContent + fileEntry);
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

        // Read previous commit hash if exists
        const headFile = path.join(process.cwd(), '.mygit', 'refs', 'heads', 'main');
        const parentCommit = fs.existsSync(headFile) ? fs.readFileSync(headFile, 'utf-8').trim() : null;

        // Create commit object
        const commitObj = {
            message: commitMessage,
            files: stagedFiles,
            timestamp: new Date().toISOString(),
            parent: parentCommit
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
        fs.writeFileSync(headFile, commitHash);

        // Clear the staging area (index) after commit
        fs.writeFileSync(indexPath, '');

        console.log('Staging area cleared. Commit completed.');
    });

// Command to check the status of the repository
program
    .command('status')
    .description('Show the status of the repository')
    .action(() => {
        const indexPath = path.join(process.cwd(), '.mygit', 'index');

        if (!fs.existsSync(indexPath) || fs.readFileSync(indexPath, 'utf-8').trim() === '') {
            console.log('No files staged for commit.');
            return;
        }

        const stagedFiles = fs.readFileSync(indexPath, 'utf-8').split('\n').filter(line => line);
        console.log('Staged files:');
        stagedFiles.forEach(file => console.log(`  - ${file.split(' ')[1]}`));
    });

// Command to view commit history
program
    .command('log')
    .description('View commit history')
    .action(() => {
        const headFile = path.join(process.cwd(), '.mygit', 'refs', 'heads', 'main');

        if (!fs.existsSync(headFile)) {
            console.log('No commit history found.');
            return;
        }

        let commitHash = fs.readFileSync(headFile, 'utf-8').trim();

        while (commitHash) {
            const commitPath = path.join(process.cwd(), '.mygit', 'objects', commitHash.substring(0, 2), commitHash.substring(2));
            if (!fs.existsSync(commitPath)) break;

            const commitData = JSON.parse(fs.readFileSync(commitPath, 'utf-8'));
            console.log(`Commit: ${commitHash}`);
            console.log(`Date: ${commitData.timestamp}`);
            console.log(`Message: ${commitData.message}`);
            console.log('---------------------');

            commitHash = commitData.parent; // Traverse parent commits
        }
    });

// Parse command-line arguments
program.parse(process.argv);
