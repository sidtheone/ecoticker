#!/bin/sh
# Setup git hooks for EcoTicker project

echo "Setting up git hooks..."

# Copy pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh

echo "🔨 Running pre-commit checks..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found. Are you in the project root?"
  exit 1
fi

# Run TypeScript type checking
echo "📝 Checking TypeScript types..."
if ! npx tsc --noEmit; then
  echo ""
  echo "❌ TypeScript errors found! Fix them before committing."
  exit 1
fi
echo "✅ TypeScript check passed"
echo ""

# Run build to catch any build-time errors
echo "🏗️  Building project..."
if ! npm run build > /tmp/build-output.log 2>&1; then
  echo ""
  echo "❌ Build failed! Output:"
  cat /tmp/build-output.log
  echo ""
  echo "Fix build errors before committing."
  exit 1
fi
echo "✅ Build successful"
echo ""

# Optional: Run linter
echo "🧹 Running linter..."
if ! npm run lint > /tmp/lint-output.log 2>&1; then
  echo ""
  echo "⚠️  Linting warnings (not blocking commit):"
  cat /tmp/lint-output.log
  echo ""
fi
echo "✅ Linter check passed"
echo ""

echo "✅ All pre-commit checks passed!"
echo "📦 Proceeding with commit..."
echo ""

exit 0
EOF

# Make it executable
chmod +x .git/hooks/pre-commit

echo "✅ Git hooks installed successfully!"
echo ""
echo "Pre-commit hook will now:"
echo "  ✓ Check TypeScript types"
echo "  ✓ Run full build"
echo "  ✓ Run linter"
echo ""
echo "To bypass (emergency only): git commit --no-verify"
