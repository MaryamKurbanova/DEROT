require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'DerotDeviceActivityChart'
  s.version        = package['version']
  s.summary        = 'DEROT Device Activity report host'
  s.license        = 'MIT'
  s.author         = 'DEROT'
  s.homepage       = 'https://github.com/derot/derot'
  s.platforms      = { :ios => '16.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'DeviceActivity', 'FamilyControls', 'ManagedSettings', 'SwiftUI'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
