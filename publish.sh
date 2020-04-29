#!/bin/zsh

if [ "`git status -s`" ]
then
    echo "The working directory is dirty. Please commit any pending changes."
    exit 1;
fi

echo "Deleting old publication"
rm -rf ./public
mkdir ./public
git worktree prune
rm -rf .git/worktrees/public/

echo "Checking out 'master' branch into './public'"
git worktree add -B master ./public origin/master

echo "Removing existing files"
rm -rf ./public/*
cp CNAME ./public


echo "Generating site"
env PATH=$PWD/bin:$PATH hugo

echo "Updating 'master' branch"
cd ./public && git add --all && git commit -m "Publishing to 'master' (publish.sh)"



#echo "Pushing to github"
#git push --all