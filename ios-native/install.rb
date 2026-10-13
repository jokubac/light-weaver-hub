# Copies NOX's Swift files into the generated iOS project, adds them to the App target
# and points the storyboard at NoxViewController. Run from the repo root after `cap sync ios`.
require "xcodeproj"
require "fileutils"

app_dir = "ios/App/App"
files = Dir["ios-native/*.swift"]
files.each { |f| FileUtils.cp(f, app_dir) }

project = Xcodeproj::Project.open("ios/App/App.xcodeproj")
target = project.targets.find { |t| t.name == "App" }
group = project.main_group.find_subpath("App", false) || project.main_group
files.each do |f|
  name = File.basename(f)
  next if group.files.any? { |r| r.path == name }
  target.add_file_references([group.new_reference(name)])
end
project.save

sb = File.join(app_dir, "Base.lproj", "Main.storyboard")
text = File.read(sb)
text = text.gsub(/customClass="CAPBridgeViewController" customModule="Capacitor"/, 'customClass="NoxViewController" customModule="App" customModuleProvider="target"')
abort("Storyboard still uses CAPBridgeViewController") unless text.include?("NoxViewController")
File.write(sb, text)
puts "Installed #{files.size} NOX native files"
