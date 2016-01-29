
Meteor.startup(function(){
    fs = Meteor.npmRequire('fs')
    path = Meteor.npmRequire('path')
    wrench = Meteor.npmRequire('wrench')
    exec = Meteor.npmRequire('child_process').exec
    sys = Meteor.npmRequire('sys')
    execSync = Meteor.npmRequire('execSync')
    // fiber = Meteor.npmRequire('fibers')
});

Meteor.methods({
    toggleExam: function(){
         check(this.userId, String)
         var current = ExamCollection.findOne({type: "status"})
         if (!current)
            ExamCollection.insert({type: "status", open: true})
        else
            ExamCollection.update({type: "status"}, {$set: {open: !current.open}})
    },
    getGitLink: function(studentName) {
        check(studentName, String)
        if (!studentName) throw new Meteor.Error("Need student name")
        var examPath = "/srv/eksam/"

        var hash = ExamCollection.insert({
            studentName: studentName,
            createdAt: new Date(),
        })
        console.log("HASH",hash);

        // Get raw repo path
        var rawPath = examPath + "toores/"
        console.log("rawPath", rawPath);
        var ls = fs.readdirSync(rawPath).filter(function(file) {
            return fs.statSync(path.join(rawPath, file)).isDirectory();
        });
        var secretRawRepo = path.join(rawPath, ls[0]) // the repo with all variants of exam exercises

        // Copy repo to temp
        var temp = 'temp'
        var tempRepo = path.join(rawPath, temp, hash)
        console.log("tempRepo", tempRepo);
        try {
            wrench.copyDirSyncRecursive(secretRawRepo, tempRepo);
        } catch (e) {
            throw new Meteor.Error("chmod error", e)
        }

        // Delete all but one file in each exercise type
        var srcPath = path.join(tempRepo, "src")
        console.log("srcPath", srcPath);
        var allTypes = fs.readdirSync(srcPath).filter(function(file){
            var isDir = fs.statSync(path.join(srcPath, file)).isDirectory()
            var isVisible = file.charAt(0) !== '.'
            return isDir && isVisible
        })
        console.log("allTypes", allTypes);
        allTypes.forEach(function(dir){
            var fullPath = path.join(srcPath, dir)
            console.log("fullPath", fullPath);
            var files = fs.readdirSync(fullPath)
            var rand = Math.floor(Math.random() * files.length)
            console.log("RANDOM", rand);
            files.splice(rand, 1)
            console.log("FILES", files);
            files.forEach(function(file){
                fs.unlink(path.join(fullPath, file))
            })
        })

        // Reinit git
        var initCmd = "cd "+tempRepo+" && rm -rf .git && git init && git add --all"
        console.log("initCmd", initCmd);
        var result = execSync.exec(initCmd)
        console.log("EXEC INIT DONE");
        console.log(result.code);
        console.log(result.stdout);
        console.log(result.stderr);

        // Add and commit changes
        // Committing was a real fucking pain. took two days. Commit was always
        // rejected, because there was no author. Even though meteoruser is identifies.
        // What eventually helped: http://stackoverflow.com/a/24850533/1905229
        console.log("IDENTIFY");
        result = execSync.exec('cd '+tempRepo+" && git config user.name server")
        result = execSync.exec('cd '+tempRepo+" && git config user.email server@server.com")
        console.log("COMMIT");
        var commitCmd = 'cd '+tempRepo+' && git commit -m "commit this shit already"'
        result = execSync.exec(commitCmd)
        console.log(result.code);
        console.log(result.stdout);
        console.log(result.stderr);

        var studentsReposPath = path.join(examPath, 'tudeng')
        var masterGitCmd = ""

        // Clone bare repo
        masterGitCmd += " cd " + studentsReposPath + " && git clone --bare " + tempRepo + " " + hash + ".git"

        console.log("EXEC CLONE");
        result = execSync.exec(masterGitCmd)
        console.log("EXEC CLONE DONE");
        console.log(result.code);
        console.log(result.stdout);
        // Fix permissions
        try {
            var targetPath = path.join(studentsReposPath, hash+".git")
            wrench.chmodSyncRecursive(targetPath, 0777);
        } catch (e) {
            throw new Meteor.Error("chmod error", e)
        }

        console.log("Give student the git repo link");
        return {gitlink: "git@i200.itcollege.ee:tudeng/" + hash + ".git"}
    },
    updatePoints: function(id, value) {
        check(this.userId, String);
        ExamCollection.update(id, {$set: {points: value}})
    },
    updateDate: function(id, value) {
        check(this.userId, String);
        ExamCollection.update(id, {$set: {date: value}})
    },
    emptyAllExamsPermanently: function() {
        check(this.userId, String);
        ExamCollection.remove({})
    }
});
